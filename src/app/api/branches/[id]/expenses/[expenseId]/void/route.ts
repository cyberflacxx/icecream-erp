import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';
import { financeService, findJournalBySource, postFinanceDocument } from '@/lib/finance-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branch.expense.approve', 'finance.write', 'branchExpense.approve')) return forbidden();

  try {
    const { expenseId, id: branchId } = await params;
    ensureBranchScope(ctx, branchId);

    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = String(body.reason ?? '').trim();
    if (!reason) return badRequest('reason is required');

    const service = createServiceRoleClient().schema('icecream_erp');
    const { data: expense, error: expenseError } = await service
      .from('branch_expenses')
      .select('id, organization_id, branch_id, amount, category, description, expense_date, status')
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', branchId)
      .eq('id', expenseId)
      .maybeSingle();
    if (expenseError) throw expenseError;
    if (!expense) return notFound('Branch expense not found.');

    const status = String(expense.status ?? '').toUpperCase();
    if (status === 'VOIDED' || status === 'REVERSED') return badRequest('Branch expense has already been voided.');
    if (status !== 'POSTED') return badRequest('Only posted branch expenses can be voided.');

    const existingReversal = await findJournalBySource(ctx.organizationId, 'branches', 'branch_expense_void', expenseId);
    if (existingReversal) return badRequest('Branch expense reversal already exists.');

    const originalJournal = await findJournalBySource(ctx.organizationId, 'branches', 'branch_expense', expenseId);
    if (!originalJournal) return badRequest('Original branch expense journal was not found.');

    const journalService = financeService();
    const linesResult = await journalService
      .from('journal_entry_lines')
      .select('account_id, branch_id, cost_center_code, description, debit_amount, credit_amount')
      .eq('journal_entry_id', originalJournal.id);
    if (linesResult.error) throw linesResult.error;

    const originalLines = linesResult.data ?? [];
    if (originalLines.length === 0) return badRequest('Original branch expense journal has no lines to reverse.');

    const reversalJournal = await postFinanceDocument({
      branchId,
      createdBy: ctx.userId,
      description: `Void branch expense ${expense.category}: ${reason}`,
      journalDate: new Date().toISOString().slice(0, 10),
      lines: originalLines.map((line) => ({
        accountId: String(line.account_id),
        branchId: line.branch_id ? String(line.branch_id) : branchId,
        costCenterCode: line.cost_center_code ? String(line.cost_center_code) : undefined,
        creditAmount: Number(line.debit_amount ?? 0),
        debitAmount: Number(line.credit_amount ?? 0),
        description: `Reversal: ${line.description ?? expense.description ?? reason}`,
      })),
      organizationId: ctx.organizationId,
      sourceDocumentId: expenseId,
      sourceDocumentType: 'branch_expense_void',
      sourceModule: 'branches',
    });

    const { data: updated, error: updateError } = await service
      .from('branch_expenses')
      .update({
        status: 'VOIDED',
        updated_at: new Date().toISOString(),
        void_reason: reason,
        voided_at: new Date().toISOString(),
        voided_by: ctx.userId,
      })
      .eq('id', expenseId)
      .select()
      .single();
    if (updateError) throw updateError;

    await writeBranchAuditLog(
      'EXPENSE_VOIDED',
      expenseId,
      ctx.userId,
      { branchId, originalJournalId: originalJournal.id, reason, reversalJournalId: reversalJournal.id },
      'branch_expense',
    );
    await writeBranchAuditLog(
      'JOURNAL_REVERSED',
      String(reversalJournal.id),
      ctx.userId,
      { branchExpenseId: expenseId, originalJournalId: originalJournal.id, reason },
      'journal_entry',
    );

    return NextResponse.json({ ...updated, reversalJournal }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to void branch expense.');
  }
}
