import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';
import { calculateBranchProfitability } from '@/lib/branches';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shiftId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write', 'finance.read')) return forbidden();

  const { id, shiftId } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as { approvalStatus?: string; reconciliationNote?: string };

    const { data: shift, error: shiftError } = await service
      .from('branch_shift_closes')
      .select('id, branch_id, status, total_sales:cash_sales, expected_cash, cash_variance, stock_variance, stock_sold_value, expenses_total')
      .eq('id', shiftId)
      .eq('branch_id', id)
      .maybeSingle();
    if (shiftError) throw shiftError;
    if (!shift) return badRequest('Shift not found');

    const { grossProfit, netProfit } = calculateBranchProfitability(
      Number(shift.total_sales ?? 0),
      Number(shift.stock_sold_value ?? 0),
      0,
      Number(shift.expenses_total ?? 0),
    );

    const { data, error } = await service
      .from('branch_reconciliations')
      .insert({
        branch_id: id,
        shift_close_id: shiftId,
        sales_total: Number(shift.total_sales ?? 0),
        cash_total: Number(shift.expected_cash ?? 0),
        expense_total: Number(shift.expenses_total ?? 0),
        stock_variance: Number(shift.stock_variance ?? 0),
        cash_variance: Number(shift.cash_variance ?? 0),
        profitability_amount: netProfit,
        reconciliation_note: body.reconciliationNote ?? null,
        reconciled_by: ctx.userId,
        reconciled_at: new Date().toISOString(),
        approval_status: body.approvalStatus ?? 'APPROVED',
      })
      .select()
      .single();
    if (error) throw error;

    await writeBranchAuditLog('BRANCH_SHIFT_RECONCILED', data.id, ctx.userId, { branchId: id, shiftId, grossProfit, netProfit }, 'branch_reconciliation');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
