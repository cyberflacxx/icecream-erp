import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const service = salesService();
    const { data: note, error: noteError } = await service
      .from('sales_credit_notes')
      .select('id, customer_id, amount')
      .eq('id', id)
      .single();
    if (noteError) throw noteError;

    const { data, error } = await service
      .from('sales_credit_notes')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    const { data: customer } = await service.from('customers').select('current_balance').eq('id', note.customer_id).single();
    await service.from('customers').update({
      current_balance: Math.max(0, Number(customer?.current_balance ?? 0) - Number(note.amount ?? 0)),
    }).eq('id', note.customer_id);

    await writeSalesAuditLog('SALES_CREDIT_NOTE_APPROVED', id, ctx.userId, { status: 'APPROVED' }, 'sales_credit_note');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
