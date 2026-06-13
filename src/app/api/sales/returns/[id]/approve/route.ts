import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const service = salesService();
    const { data, error } = await service
      .from('customer_returns')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await writeSalesAuditLog('SALES_RETURN_APPROVED', id, ctx.userId, { status: 'APPROVED' }, 'customer_return');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
