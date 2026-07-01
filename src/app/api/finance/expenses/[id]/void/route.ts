import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.expense.post', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!body.reason) return badRequest('reason is required');

    const { data: expense, error } = await financeService()
      .from('finance_expenses')
      .select('id, status')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!expense) return notFound('Expense not found.');
    if (String(expense.status ?? '').toUpperCase() !== 'POSTED') {
      return badRequest('Only posted expenses can be voided.');
    }

    const { data: updated, error: updateError } = await financeService()
      .from('finance_expenses')
      .update({
        rejection_reason: body.reason,
        status: 'VOIDED',
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError || !updated) return serverError(updateError?.message ?? 'Failed to void expense.');

    await writeFinanceAuditLog('FINANCE_EXPENSE_VOIDED', id, ctx.userId, { reason: body.reason }, 'finance_expense');
    return NextResponse.json(updated);
  } catch (error) {
    if (isMissingFinanceTable(error)) return serverError('Finance expenses table is not deployed in the live database yet.');
    return serverError(error instanceof Error ? error.message : 'Failed to void expense.');
  }
}
