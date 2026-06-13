import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildShiftPerformanceRows } from '@/lib/production';
import { loadProductionReportBatches, productionService } from '@/lib/production-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const { batches, workerCounts } = await loadProductionReportBatches({
      branchId: ctx.isBranchScoped ? ctx.branchId : (searchParams.get('branchId') ?? null),
      endDate: searchParams.get('endDate') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
    });
    const service = productionService();
    const { data: targets, error } = await service.from('production_shift_targets').select('*');
    if (error) throw error;

    return NextResponse.json(buildShiftPerformanceRows(batches, (targets ?? []) as Array<Record<string, unknown>>, workerCounts));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
