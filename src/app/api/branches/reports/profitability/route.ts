import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateBranchProfitability } from '@/lib/branches';
import { branchService } from '@/lib/branches-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'finance.read')) return forbidden();
  try {
    const service = branchService();
    const { data, error } = await service.from('branch_reconciliations').select('branch_id, shift_close_id, sales_total, expense_total, profitability_amount, stock_variance, cash_variance').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((row) => ({
      ...row,
      derived: calculateBranchProfitability(Number(row.sales_total ?? 0), 0, 0, Number(row.expense_total ?? 0)),
    }));
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
