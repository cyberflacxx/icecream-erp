import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeBalanceSheetFromLedger } from '@/lib/finance';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const costCenterCode = searchParams.get('costCenterCode') ?? undefined;
    const asOfDate = searchParams.get('endDate') ?? undefined;
    const totals = summarizeBalanceSheetFromLedger(await loadLedgerLines(ctx.organizationId, true, {
      branchId,
      costCenterCode,
      endDate: asOfDate,
    }));
    return NextResponse.json({
      ...totals,
      asOfDate: asOfDate ?? null,
      filters: {
        branchId: branchId ?? null,
        costCenterCode: costCenterCode ?? null,
      },
      isBalanced: Math.abs(totals.assets - (totals.liabilities + totals.equity)) <= 0.01,
    });
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
