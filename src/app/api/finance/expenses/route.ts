import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('finance_expenses')
      .select('id, expense_date, category, branch_id, department_id, account_id, amount, payment_method, description, status, source_document')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      accountId?: string;
      amount: number;
      branchId?: string;
      category: string;
      departmentId?: string;
      description: string;
      expenseDate: string;
      paymentMethod?: string;
      sourceDocument?: string;
      supportingDocument?: string;
    };

    if (!body.expenseDate || !body.category || !body.description || Number(body.amount) <= 0) {
      return badRequest('expenseDate, category, description, and a positive amount are required');
    }

    const { data, error } = await financeService()
      .from('finance_expenses')
      .insert({
        organization_id: ctx.organizationId,
        expense_date: body.expenseDate,
        category: body.category,
        branch_id: body.branchId ?? null,
        department_id: body.departmentId ?? null,
        account_id: body.accountId ?? null,
        amount: body.amount,
        payment_method: body.paymentMethod ?? 'Cash',
        supporting_document: body.supportingDocument ?? null,
        description: body.description,
        source_document: body.sourceDocument ?? null,
        status: 'DRAFT',
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('FINANCE_EXPENSE_CREATED', data.id, ctx.userId, { amount: body.amount, category: body.category }, 'finance_expense');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
