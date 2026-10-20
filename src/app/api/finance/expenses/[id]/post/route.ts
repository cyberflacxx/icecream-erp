import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable } from '@/lib/finance-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.expense.post', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { idempotencyKey?: unknown };
    const { data, error } = await financeService().rpc('post_finance_expense_payment', {
      p_actor_user_profile_id: ctx.userId,
      p_expense_id: id,
      p_idempotency_key: String(body.idempotencyKey ?? '').trim() || null,
      p_organization_id: ctx.organizationId,
    });
    if (error) return badRequest(financeErrorMessage(error) || 'Failed to post expense payment.');
    return NextResponse.json(data);
  } catch (error) {
    if (isMissingFinanceTable(error)) return serverError('Finance expenses table is not deployed in the live database yet.');
    return serverError(error instanceof Error ? error.message : 'Failed to post expense.');
  }
}
