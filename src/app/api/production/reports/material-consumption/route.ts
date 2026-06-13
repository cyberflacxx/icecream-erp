import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { asArray, asObject, toNumber } from '@/lib/inventory';
import { loadProductionReportBatches } from '@/lib/production-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const { batches } = await loadProductionReportBatches({
      branchId: ctx.isBranchScoped ? ctx.branchId : (searchParams.get('branchId') ?? null),
      endDate: searchParams.get('endDate') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
    });

    const rows = batches.flatMap((batch) =>
      asArray(batch.production_batch_materials).map((material) => {
        const item = asObject(material.items);
        return {
          actualQuantity: toNumber(material.quantity_actual ?? material.quantity_issued),
          batchNumber: String(batch.batch_number ?? ''),
          expectedQuantity: toNumber(material.quantity_required),
          itemName: String(item?.name ?? 'Unknown item'),
          quantityVariance: toNumber(material.quantity_actual ?? material.quantity_issued) - toNumber(material.quantity_required),
          shift: String(batch.shift ?? ''),
        };
      }),
    );

    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
