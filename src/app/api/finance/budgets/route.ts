import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, generateFinanceReferenceNumber, writeFinanceAuditLog } from '@/lib/finance-server';

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

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
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

    const { data, error } = await service
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
    if (error) throw error;

    if ((body.lines ?? []).length > 0) {
      await service.from('budget_lines').insert(
        body.lines!.map((line) => ({
          budget_id: data.id,
          account_id: line.accountId,
          annual_total: line.annualTotal,
        })),
      );
    }

    await writeFinanceAuditLog('BUDGET_CREATED', data.id, ctx.userId, { budgetCode, totalBudgeted }, 'budget');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
