import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateBudgetVariance } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'budget.read', 'reports.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('budgets')
      .select('id, name, budget_year, total_budgeted, branch_id')
      .is('deleted_at', null)
      .order('budget_year', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const actualAmount = 0;
      const variance = calculateBudgetVariance(Number(row.total_budgeted ?? 0), actualAmount);
      return {
        actualAmount,
        branchId: row.branch_id,
        budgetName: row.name,
        budgetYear: row.budget_year,
        budgetedAmount: Number(row.total_budgeted ?? 0),
        variance: variance.variance,
        variancePct: variance.variancePct,
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
