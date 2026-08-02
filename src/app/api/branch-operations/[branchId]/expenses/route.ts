import { NextRequest, NextResponse } from 'next/server';

import { apiServerError, badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { ensureBranchScope, requireOpenShift, writeBranchAuditLog } from '@/lib/branches-server';
import { findOpenFiscalPeriod, resolveFinanceCostCentreCode, resolveFinancePostingAccount } from '@/lib/finance-foundation-server';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

function paymentMappingKey(paymentMethod: string) {
  const normalized = String(paymentMethod ?? '').trim().toUpperCase();
  if (normalized === 'BANK') return { fallbackAccountCode: '1120', key: 'BANK_ACCOUNT' };
  if (normalized === 'PETTY_CASH') return { fallbackAccountCode: '1130', key: 'PETTY_CASH_ACCOUNT' };
  return { fallbackAccountCode: '1110', key: 'CASH_ACCOUNT' };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'branch.expense.read', 'branchExpense.read')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const paymentMethod = searchParams.get('paymentMethod') ?? undefined;

  try {
    ensureBranchScope(ctx, branchId);

    const from = (page - 1) * pageSize;
    const buildQuery = (includeDeletedAt: boolean) => {
      let query = service
        .schema('icecream_erp')
        .from('branch_expenses')
        .select('id, amount, category, description, expense_date, payment_method, created_by, status', { count: 'exact' })
        .eq('branch_id', branchId)
        .order('expense_date', { ascending: false });

      if (includeDeletedAt) {
        query = query.is('deleted_at', null);
      }
      if (paymentMethod) query = query.eq('payment_method', paymentMethod);
      if (startDate) query = query.gte('expense_date', `${startDate}T00:00:00.000Z`);
      if (endDate) query = query.lte('expense_date', `${endDate}T23:59:59.999Z`);

      return query.range(from, from + pageSize - 1);
    };

    let result = await buildQuery(true);
    if (result.error && isMissingColumnError(result.error, 'branch_expenses', 'deleted_at')) {
      result = await buildQuery(false);
    }
    if (result.error) throw result.error;

    return NextResponse.json({
      data: (result.data ?? []).map((row: Record<string, unknown>) => ({
        amount: Number(row.amount ?? 0),
        category: row.category,
        description: row.description,
        expenseDate: row.expense_date,
        id: row.id,
        paymentMethod: row.payment_method,
        status: row.status ?? 'DRAFT',
      })),
      pagination: { page, pageSize, total: result.count ?? 0 },
    });
  } catch (error) {
    return apiServerError({
      branchId,
      ctx,
      error,
      message: 'Branch expenses could not be loaded.',
      module: 'branch.expenses',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'branch.expense.create', 'branchExpense.create')) {
    return forbidden('You do not have permission to post branch expenses.');
  }

  const { branchId } = await params;
  const service = createServiceRoleClient();

  try {
    ensureBranchScope(ctx, branchId);

    const body = await request.json() as {
      amount: number;
      category: string;
      description: string;
      expenseDate?: string;
      paymentMethod: string;
      receiptUrl?: string;
      shift?: string;
    };

    if (!body.amount || !body.category || !body.description || !body.paymentMethod) {
      return badRequest('amount, category, description, paymentMethod are required');
    }

    const expenseDate = body.expenseDate ?? new Date().toISOString().slice(0, 10);
    const openShift = body.shift ? await requireOpenShift(branchId, body.shift, expenseDate) : null;

    const branchResult = await service
      .schema('icecream_erp')
      .from('branches')
      .select('id, organization_id, status, deleted_at')
      .eq('organization_id', ctx.organizationId)
      .eq('id', branchId)
      .maybeSingle();
    if (branchResult.error) throw branchResult.error;
    if (!branchResult.data || branchResult.data.deleted_at) {
      return badRequest('The selected branch could not be found.');
    }
    if (String(branchResult.data.status ?? '').toUpperCase() !== 'ACTIVE') {
      return badRequest('The selected branch is inactive.');
    }

    try {
      await resolveFinanceCostCentreCode(ctx.organizationId, { branchId, preferredCodes: ['SALES'] });
    } catch {
      return badRequest('The branch cost centre has not been configured.');
    }

    try {
      const mapping = paymentMappingKey(body.paymentMethod);
      await Promise.all([
        findOpenFiscalPeriod(ctx.organizationId, expenseDate),
        resolveFinancePostingAccount(ctx.organizationId, mapping.key, {
          branchId,
          fallbackAccountCode: mapping.fallbackAccountCode,
        }),
        resolveFinancePostingAccount(ctx.organizationId, 'DEFAULT_BRANCH_EXPENSE', {
          branchId,
          fallbackAccountCode: '6100',
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('No open fiscal period')) {
        return badRequest('The selected financial period is closed.');
      }
      if (message.includes('Missing active account mapping') || message.includes('Fallback account')) {
        return badRequest('No payment account is linked to this branch.');
      }
      if (message.includes('inactive')) {
        return badRequest('The expense account is inactive.');
      }
      throw error;
    }

    const modernInsert = await service
      .schema('icecream_erp')
      .from('branch_expenses')
      .insert({
        amount: body.amount,
        branch_id: branchId,
        category: body.category,
        created_by: ctx.userId,
        description: body.description,
        expense_date: new Date(`${expenseDate}T00:00:00.000Z`).toISOString(),
        payment_method: body.paymentMethod,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        receipt_url: body.receiptUrl ?? null,
        shift_close_id: openShift?.id ?? null,
        status: 'POSTED',
      })
      .select()
      .single();

    let expenseResult = modernInsert;
    if (
      modernInsert.error &&
      (
        isMissingColumnError(modernInsert.error, 'branch_expenses', 'receipt_url') ||
        isMissingColumnError(modernInsert.error, 'branch_expenses', 'shift_close_id') ||
        isMissingColumnError(modernInsert.error, 'branch_expenses', 'posted_at') ||
        isMissingColumnError(modernInsert.error, 'branch_expenses', 'posted_by')
      )
    ) {
      expenseResult = await service
        .schema('icecream_erp')
        .from('branch_expenses')
        .insert({
          amount: body.amount,
          branch_id: branchId,
          category: body.category,
          created_by: ctx.userId,
          description: body.description,
          expense_date: new Date(`${expenseDate}T00:00:00.000Z`).toISOString(),
          payment_method: body.paymentMethod,
          status: 'POSTED',
        })
        .select()
        .single();
    }

    if (expenseResult.error || !expenseResult.data) {
      throw expenseResult.error ?? new Error('Failed to record branch expense.');
    }

    await writeBranchAuditLog(
      'BRANCH_EXPENSE_CREATED',
      String(expenseResult.data.id),
      ctx.userId,
      { amount: body.amount, branchId, category: body.category },
      'branch_expense',
    );

    return NextResponse.json(expenseResult.data, { status: 201 });
  } catch (error) {
    return apiServerError({
      branchId,
      ctx,
      error,
      message: 'The branch expense could not be recorded.',
      module: 'branch.expenses',
      path: request.nextUrl.pathname,
      status: 500,
      transactionReference: `branch-expense:${branchId}`,
    });
  }
}
