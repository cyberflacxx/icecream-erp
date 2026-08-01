import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeCostCentreProfitAndLossFromLedger } from '@/lib/finance';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const costCenterCode = searchParams.get('costCenterCode') ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const rows = summarizeCostCentreProfitAndLossFromLedger(await loadLedgerLines(ctx.organizationId, true, {
      branchId,
      costCenterCode,
      endDate,
      startDate,
    }));

    return NextResponse.json({
      filters: {
        branchId: branchId ?? null,
        costCenterCode: costCenterCode ?? null,
        endDate: endDate ?? null,
        startDate: startDate ?? null,
      },
      rows,
    });
  } catch (error) {
    return serverError(financeErrorMessage(error) || 'Failed to load cost centre profitability.');
  }
}
