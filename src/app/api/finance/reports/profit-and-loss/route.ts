import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';
import { summarizeProfitAndLossFromLedger } from '@/lib/finance';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const costCenterCode = searchParams.get('costCenterCode') ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const summary = summarizeProfitAndLossFromLedger(await loadLedgerLines(ctx.organizationId, true, {
      branchId,
      costCenterCode,
      endDate,
      startDate,
    }));
    return NextResponse.json({
      ...summary,
      filters: {
        branchId: branchId ?? null,
        costCenterCode: costCenterCode ?? null,
        endDate: endDate ?? null,
        startDate: startDate ?? null,
      },
      grossProfit: summary.grossProfit,
      netProfit: summary.netProfit,
    });
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
