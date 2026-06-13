import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateBranchCostSummary } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('branch_reconciliations')
      .select('branch_id, sales_total, expense_total, profitability_amount, cash_variance, stock_variance')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const summary = calculateBranchCostSummary(
        Number(row.sales_total ?? 0),
        0,
        Number(row.expense_total ?? 0),
        0,
      );
      return {
        branchId: row.branch_id,
        cashVariance: Number(row.cash_variance ?? 0),
        expenseTotal: Number(row.expense_total ?? 0),
        grossProfit: summary.grossProfit,
        netProfit: summary.netProfit,
        salesTotal: Number(row.sales_total ?? 0),
        stockVariance: Number(row.stock_variance ?? 0),
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
