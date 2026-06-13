import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildCostingRows, buildProductivityRows, buildYieldRows } from '@/lib/production';
import { loadProductionReportBatches } from '@/lib/production-server';

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
      status: searchParams.get('status') ?? undefined,
    });
    const yieldRows = buildYieldRows(batches);
    const productivityRows = buildProductivityRows(batches, workerCounts);
    const costingRows = buildCostingRows(batches);

    return NextResponse.json(batches.map((batch, index) => ({
      batchNumber: String(batch.batch_number ?? ''),
      costPerUnit: costingRows[index]?.costPerUnit ?? 0,
      actualOutput: Number(batch.actual_output ?? 0),
      expectedOutput: Number(batch.expected_output ?? 0),
      productivity: productivityRows[index]?.outputPerWorker ?? 0,
      shift: String(batch.shift ?? ''),
      yieldPercentage: yieldRows[index]?.yieldPercentage ?? 0,
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
