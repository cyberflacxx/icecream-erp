import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.expense.view', 'finance.read')) return forbidden();

  try {
    const { id } = await params;
    const { data, error } = await financeService()
      .from('finance_expenses')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return notFound('Expense not found.');
    return NextResponse.json(data);
  } catch (error) {
    if (isMissingFinanceTable(error)) return serverError('Finance expenses table is not deployed in the live database yet.');
    return serverError(financeErrorMessage(error) || 'Internal server error');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.expense.edit', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      accountId?: string | null;
      amount?: number;
      category?: string | null;
      description?: string | null;
      expenseDate?: string | null;
      paymentMethod?: string | null;
    };

    const { data: existing, error: existingError } = await financeService()
      .from('finance_expenses')
      .select('id, status')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return notFound('Expense not found.');
    if (String(existing.status ?? '').toUpperCase() === 'POSTED') {
      return badRequest('Posted expenses cannot be edited.');
    }

    const updates: Record<string, unknown> = {};
    if (body.accountId !== undefined) updates.account_id = body.accountId ?? null;
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.category !== undefined) updates.category = body.category ?? null;
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (body.expenseDate !== undefined) updates.expense_date = body.expenseDate ?? null;
    if (body.paymentMethod !== undefined) updates.payment_method = body.paymentMethod ?? null;
    updates.updated_at = new Date().toISOString();
    updates.updated_by = ctx.userId;

    const { data, error } = await financeService()
      .from('finance_expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('FINANCE_EXPENSE_UPDATED', id, ctx.userId, updates, 'finance_expense');
    return NextResponse.json(data);
  } catch (error) {
    if (isMissingFinanceTable(error)) return serverError('Finance expenses table is not deployed in the live database yet.');
    return serverError(financeErrorMessage(error) || 'Internal server error');
  }
}
