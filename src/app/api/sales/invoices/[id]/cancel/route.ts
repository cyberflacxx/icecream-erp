import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { reason?: string };
    if (!body.reason?.trim()) return badRequest('Cancellation reason is required.');

    const service = salesService();
    const { data, error } = await service
      .from('invoices')
      .update({
        status: 'CANCELLED',
        void_reason: body.reason.trim(),
        voided_at: new Date().toISOString(),
        voided_by: ctx.userId,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await writeSalesAuditLog('SALES_INVOICE_CANCELLED', id, ctx.userId, { reason: body.reason }, 'invoice');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
