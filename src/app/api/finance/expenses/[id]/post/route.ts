import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { postFinanceDocument, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.expense.post', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const { data: expense, error } = await financeService()
      .from('finance_expenses')
      .select('id, expense_date, account_id, amount, payment_method, description, status')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!expense) return notFound('Expense not found.');
    if (String(expense.status ?? '').toUpperCase() === 'POSTED') return badRequest('Expense is already posted.');

    const amount = Number(expense.amount ?? 0);
    if (amount <= 0) return badRequest('Expense amount must be greater than zero.');

    const journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: String(expense.description ?? `Expense ${id}`),
      journalDate: String(expense.expense_date ?? new Date().toISOString().slice(0, 10)),
      lines: [
        {
          accountCode: expense.account_id ? undefined : '6100',
          accountId: expense.account_id ? String(expense.account_id) : undefined,
          creditAmount: 0,
          debitAmount: amount,
          description: 'Expense recognition',
        },
        {
          accountCode: String(expense.payment_method ?? '').toUpperCase() === 'BANK' ? '1000' : '1010',
          creditAmount: amount,
          debitAmount: 0,
          description: `Expense payment via ${String(expense.payment_method ?? 'CASH')}`,
        },
      ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(expense.id),
      sourceDocumentType: 'finance_expense',
      sourceModule: 'finance',
    });

    const { data: updated, error: updateError } = await financeService()
      .from('finance_expenses')
      .update({
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        status: 'POSTED',
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError || !updated) return serverError(updateError?.message ?? 'Failed to update expense status.');

    await writeFinanceAuditLog('FINANCE_EXPENSE_POSTED', id, ctx.userId, { journalId: journal.id }, 'finance_expense');
    return NextResponse.json({ ...updated, journal });
  } catch (error) {
    if (isMissingFinanceTable(error)) return serverError('Finance expenses table is not deployed in the live database yet.');
    return serverError(error instanceof Error ? error.message : 'Failed to post expense.');
  }
}
