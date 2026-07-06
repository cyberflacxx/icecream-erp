import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingSalesTable, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const { id } = await params;
    const service = salesService();
    const { data, error } = await service
      .from('quotations')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        status: 'accepted',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (isMissingSalesTable(error)) {
        return NextResponse.json({ id, status: 'accepted' });
      }
      throw error;
    }
    await writeSalesAuditLog('SALES_QUOTATION_APPROVED', id, ctx.userId, { status: 'ACCEPTED' }, 'quotation');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
