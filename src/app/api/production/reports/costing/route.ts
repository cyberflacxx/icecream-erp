import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildCostingRows } from '@/lib/production';
import { loadProductionReportBatches } from '@/lib/production-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'reports.read', 'finance.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const { batches } = await loadProductionReportBatches({
      branchId: ctx.isBranchScoped ? ctx.branchId : (searchParams.get('branchId') ?? null),
      endDate: searchParams.get('endDate') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
    });
    return NextResponse.json(buildCostingRows(batches));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
