import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { productionService } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'inventory.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('finished_goods_transfers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const batchIds = [...new Set((data ?? []).map((row) => String(row.production_batch_id ?? '')).filter(Boolean))];
    const warehouseIds = [
      ...new Set(
        (data ?? [])
          .flatMap((row) => [row.source_warehouse_id, row.destination_warehouse_id])
          .map((id) => String(id ?? ''))
          .filter(Boolean),
      ),
    ];

    const [batchesResult, warehousesResult] = await Promise.all([
      batchIds.length
        ? service.from('production_batches').select('id, batch_number, actual_output').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      warehouseIds.length
        ? service.from('warehouses').select('id, name, code').in('id', warehouseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (batchesResult.error) throw batchesResult.error;
    if (warehousesResult.error) throw warehousesResult.error;

    const batchesById = new Map((batchesResult.data ?? []).map((row) => [String(row.id), row]));
    const warehousesById = new Map((warehousesResult.data ?? []).map((row) => [String(row.id), row]));

    return NextResponse.json((data ?? []).map((row) => ({
      ...row,
      batch: batchesById.get(String(row.production_batch_id ?? '')) ?? null,
      destinationWarehouse: warehousesById.get(String(row.destination_warehouse_id ?? '')) ?? null,
      sourceWarehouse: warehousesById.get(String(row.source_warehouse_id ?? '')) ?? null,
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
