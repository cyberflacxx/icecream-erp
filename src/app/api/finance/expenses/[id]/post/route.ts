import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  createLinkedFinanceTransaction,
  financeErrorMessage,
  financeService,
  isMissingFinanceTable,
  postFinanceDocument,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

function normalizeExpensePaymentMethod(value: unknown): 'BANK' | 'CASH' | 'PETTY_CASH' {
  const method = String(value ?? 'CASH').trim().toUpperCase().replace(/\s+/g, '_');
  if (method === 'BANK') return 'BANK';
  if (method === 'PETTY_CASH') return 'PETTY_CASH';
  return 'CASH';
}

async function resolvePaymentLedgerAccount(input: {
  organizationId: string;
  paymentMethod: 'BANK' | 'CASH' | 'PETTY_CASH';
  cashAccountId?: string | null;
  bankAccountId?: string | null;
}) {
  const service = financeService();
  const table = input.paymentMethod === 'BANK' ? 'bank_accounts' : 'cash_accounts';
  const selectedAccountId = input.paymentMethod === 'BANK' ? input.bankAccountId : input.cashAccountId;
  const accountLabel = input.paymentMethod === 'BANK' ? 'bank' : 'cash';

  if (!selectedAccountId) {
    throw new Error(`${accountLabel}AccountId is required for ${accountLabel} expenses.`);
  }

  const { data, error } = await service
    .from(table)
    .select('id, account_id, current_balance, is_active, status')
    .eq('organization_id', input.organizationId)
    .eq('id', selectedAccountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`The selected ${accountLabel} account is no longer available.`);
  if (data.is_active === false || String(data.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE') {
    throw new Error(`The selected ${accountLabel} account is inactive.`);
  }
  if (!data.account_id) {
    throw new Error(`The selected ${accountLabel} account is missing its linked ledger account.`);
  }

  return {
    accountId: String(data.account_id),
    currentBalance: Number(data.current_balance ?? 0),
    selectedAccountId: String(data.id),
  };
}

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
      .select('id, expense_date, account_id, cash_account_id, bank_account_id, amount, payment_method, description, status')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!expense) return notFound('Expense not found.');
    if (String(expense.status ?? '').toUpperCase() === 'POSTED') return badRequest('Expense is already posted.');

    const amount = Number(expense.amount ?? 0);
    if (amount <= 0) return badRequest('Expense amount must be greater than zero.');
    if (!expense.account_id) return badRequest('Expense account is required before posting.');

    const paymentMethod = normalizeExpensePaymentMethod(expense.payment_method);
    let paymentAccount: Awaited<ReturnType<typeof resolvePaymentLedgerAccount>>;
    try {
      paymentAccount = await resolvePaymentLedgerAccount({
        bankAccountId: expense.bank_account_id ? String(expense.bank_account_id) : null,
        cashAccountId: expense.cash_account_id ? String(expense.cash_account_id) : null,
        organizationId: ctx.organizationId,
        paymentMethod,
      });
    } catch (paymentError) {
      return badRequest(paymentError instanceof Error ? paymentError.message : 'Expense payment account is not configured.');
    }
    if ((paymentMethod === 'CASH' || paymentMethod === 'PETTY_CASH') && paymentAccount.currentBalance < amount) {
      return badRequest('Insufficient cash balance.');
    }

    const journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: String(expense.description ?? `Expense ${id}`),
      journalDate: String(expense.expense_date ?? new Date().toISOString().slice(0, 10)),
      lines: [
        {
          accountId: String(expense.account_id),
          creditAmount: 0,
          debitAmount: amount,
          description: 'Expense recognition',
        },
        {
          accountId: paymentAccount.accountId,
          creditAmount: amount,
          debitAmount: 0,
          description: `Expense payment via ${paymentMethod}`,
        },
      ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(expense.id),
      sourceDocumentType: 'finance_expense',
      sourceModule: 'finance',
    });

    let linkedTransaction: Awaited<ReturnType<typeof createLinkedFinanceTransaction>>;
    try {
      linkedTransaction = await createLinkedFinanceTransaction({
        amount,
        createdBy: ctx.userId,
        description: String(expense.description ?? `Expense ${id}`),
        direction: 'OUT',
        organizationId: ctx.organizationId,
        paymentMethod,
        selectedAccountId: paymentAccount.selectedAccountId,
        referenceNumber: String(journal.entryNumber ?? journal.id ?? id),
        sourceDocument: `finance:expense:${id}`,
        transactionDate: String(expense.expense_date ?? new Date().toISOString().slice(0, 10)),
      });
    } catch (transactionError) {
      return badRequest(financeErrorMessage(transactionError) || 'Failed to create linked cash/bank transaction.');
    }

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

    await writeFinanceAuditLog('FINANCE_EXPENSE_POSTED', id, ctx.userId, { journalId: journal.id, linkedTransaction }, 'finance_expense');
    return NextResponse.json({ ...updated, journal, linkedTransaction });
  } catch (error) {
    if (isMissingFinanceTable(error)) return serverError('Finance expenses table is not deployed in the live database yet.');
    return serverError(error instanceof Error ? error.message : 'Failed to post expense.');
  }
}
