import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeBranchProfitAndLossFromLedger } from '@/lib/finance';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const rows = summarizeBranchProfitAndLossFromLedger(await loadLedgerLines(ctx.organizationId, true, {
      branchId,
      endDate,
      startDate,
    }));
    return NextResponse.json({
      filters: {
        branchId: branchId ?? null,
        endDate: endDate ?? null,
        startDate: startDate ?? null,
      },
      rows,
    });
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
