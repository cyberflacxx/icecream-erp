import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, generateFinanceReferenceNumber, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return financeErrorMessage(error).includes(`column ${table}.${columnName} does not exist`);
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'budget.read', 'finance.read')) return forbidden();

  const service = financeService();
  const { searchParams } = new URL(request.url);
  const budgetYear = searchParams.get('budgetYear');

  try {
    let query = service
      .from('budgets')
      .select('id, budget_code, name, budget_year, budget_type, branch_id, status, total_budgeted')
      .is('deleted_at', null)
      .order('budget_year', { ascending: false });
    if (budgetYear) query = query.eq('budget_year', Number(budgetYear));

    const primary = await query;
    if (!primary.error) return NextResponse.json(primary.data ?? []);

    if (
      !isMissingColumnError(primary.error, 'budgets', 'budget_code') &&
      !isMissingColumnError(primary.error, 'budgets', 'budget_year') &&
      !isMissingColumnError(primary.error, 'budgets', 'budget_type') &&
      !isMissingColumnError(primary.error, 'budgets', 'branch_id') &&
      !isMissingColumnError(primary.error, 'budgets', 'total_budgeted') &&
      !isMissingColumnError(primary.error, 'budgets', 'deleted_at')
    ) {
      throw primary.error;
    }

    let fallbackQuery = service
      .from('budgets')
      .select('id, name, department, period_start, period_end, status, total_budget, total_actual, variance')
      .order('period_start', { ascending: false });

    if (budgetYear) {
      fallbackQuery = fallbackQuery.gte('period_start', `${budgetYear}-01-01`).lte('period_start', `${budgetYear}-12-31`);
    }

    const fallback = await fallbackQuery;
    if (fallback.error) throw fallback.error;

    return NextResponse.json((fallback.data ?? []).map((row) => ({
      ...row,
      budget_code: null,
      budget_year: new Date(String(row.period_start)).getUTCFullYear(),
      budget_type: row.department ?? 'GENERAL',
      branch_id: null,
      total_budgeted: row.total_budget ?? 0,
    })));
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'budget.write', 'finance.write')) return forbidden();

  const service = financeService();
  try {
    const body = await request.json() as {
      branchId?: string;
      budgetType: string;
      budgetYear: number;
      lines?: Array<{ accountId: string; annualTotal: number }>;
      name: string;
      totalBudgeted?: number;
    };
    if (!body.name || !body.budgetType || !body.budgetYear) {
      return badRequest('name, budgetType, and budgetYear are required');
    }

    const budgetCode = await generateFinanceReferenceNumber('budgets', 'BGT');
    const totalBudgeted =
      body.totalBudgeted ??
      (body.lines ?? []).reduce((sum, line) => sum + Number(line.annualTotal ?? 0), 0);

    const primary = await service
      .from('budgets')
      .insert({
        budget_code: budgetCode,
        name: body.name,
        budget_year: body.budgetYear,
        budget_type: body.budgetType,
        branch_id: body.branchId ?? null,
        status: 'DRAFT',
        total_budgeted: totalBudgeted,
        created_by: ctx.userId,
      })
      .select()
      .single();
    let data = primary.data;
    let error = primary.error;

    if (
      error &&
      (
        isMissingColumnError(error, 'budgets', 'budget_code') ||
        isMissingColumnError(error, 'budgets', 'budget_year') ||
        isMissingColumnError(error, 'budgets', 'budget_type') ||
        isMissingColumnError(error, 'budgets', 'branch_id') ||
        isMissingColumnError(error, 'budgets', 'total_budgeted') ||
        isMissingColumnError(error, 'budgets', 'created_by')
      )
    ) {
      const periodStart = `${body.budgetYear}-01-01`;
      const periodEnd = `${body.budgetYear}-12-31`;
      const fallback = await service
        .from('budgets')
        .insert({
          organization_id: ctx.organizationId,
          name: body.name,
          department: body.budgetType,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'DRAFT',
          total_budget: totalBudgeted,
          total_actual: 0,
          variance: totalBudgeted,
          notes: null,
        })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) throw error ?? new Error('Failed to create budget');

    if ((body.lines ?? []).length > 0) {
      const primaryLines = await service.from('budget_lines').insert(
        body.lines!.map((line) => ({
          budget_id: data.id,
          account_id: line.accountId,
          annual_total: line.annualTotal,
        })),
      );

      if (primaryLines.error) {
        if (!isMissingColumnError(primaryLines.error, 'budget_lines', 'annual_total')) throw primaryLines.error;
        const fallbackLines = await service.from('budget_lines').insert(
          body.lines!.map((line, index) => ({
            budget_id: data.id,
            account_id: line.accountId,
            description: `Budget line ${index + 1}`,
            budgeted_amount: line.annualTotal,
            actual_amount: 0,
            variance: line.annualTotal,
            month: null,
          })),
        );
        if (fallbackLines.error) throw fallbackLines.error;
      }
    }

    await writeFinanceAuditLog('BUDGET_CREATED', data.id, ctx.userId, { budgetCode, totalBudgeted }, 'budget');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
