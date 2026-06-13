import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeProfitAndLoss } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [invoices, branchSales, expenses, branchExpenses] = await Promise.all([
      financeService().from('invoices').select('total').eq('organization_id', ctx.organizationId).is('deleted_at', null),
      financeService().from('branch_sales').select('total_amount').eq('organization_id', ctx.organizationId).is('deleted_at', null),
      financeService().from('finance_expenses').select('amount').eq('organization_id', ctx.organizationId).is('deleted_at', null).neq('status', 'REJECTED'),
      financeService().from('branch_expenses').select('amount').eq('organization_id', ctx.organizationId).is('deleted_at', null),
    ]);
    if (invoices.error) throw invoices.error;
    if (branchSales.error) throw branchSales.error;
    if (expenses.error) throw expenses.error;
    if (branchExpenses.error) throw branchExpenses.error;

    const revenue =
      (invoices.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0) +
      (branchSales.data ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
    const operatingExpenses =
      (expenses.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0) +
      (branchExpenses.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const result = summarizeProfitAndLoss(revenue, 0, operatingExpenses);

    return NextResponse.json({
      ...result,
      operatingExpenses,
      revenue,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
