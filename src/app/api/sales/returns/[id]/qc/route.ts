import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { finalStockAction?: string; qcNote?: string; qcStatus?: string };
    const service = salesService();
    const { data, error } = await service
      .from('customer_returns')
      .update({
        final_stock_action: body.finalStockAction ?? null,
        qc_note: body.qcNote ?? null,
        qc_status: body.qcStatus ?? 'PENDING_QC',
        status: 'PENDING_QC',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await writeSalesAuditLog('SALES_RETURN_QC_RECORDED', id, ctx.userId, { qcStatus: body.qcStatus ?? 'PENDING_QC' }, 'customer_return');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
