import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, logFinanceRouteError, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  const { id } = await params;
  try {
    const service = financeService();
    const { data, error } = await service
      .from('petty_cash_requests')
      .update({
        status: 'APPROVED',
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('PETTY_CASH_REQUEST_APPROVED', id, ctx.userId, {}, 'petty_cash_request');
    return NextResponse.json(data);
  } catch (err) {
    logFinanceRouteError('finance.petty-cash.approve', 'approve', err);
    return serverError('Petty cash approval could not be completed. Please refresh or contact support.');
  }
}
