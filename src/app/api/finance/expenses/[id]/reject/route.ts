import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.expense.approve', 'finance.approve', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { reason?: string };
    if (!body.reason) return badRequest('reason is required');

    const { data, error } = await financeService()
      .from('finance_expenses')
      .update({
        rejected_by: ctx.userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: body.reason,
        status: 'REJECTED',
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error || !data) return notFound('Expense not found');

    await writeFinanceAuditLog('FINANCE_EXPENSE_REJECTED', id, ctx.userId, { reason: body.reason }, 'finance_expense');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
