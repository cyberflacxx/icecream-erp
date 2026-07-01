import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { productionService } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'inventory.read')) return forbidden();

  try {
    const service = productionService();
    let query = service
      .from('stock_transfers')
      .select('id, transfer_number, transfer_date, status, notes, created_at, from_warehouse_id, to_warehouse_id')
      .eq('organization_id', ctx.organizationId)
      .ilike('notes', '%[production_batch:%]%');

    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: scopedWarehouses, error: scopedError } = await service
        .from('warehouses')
        .select('id')
        .eq('branch_id', ctx.branchId);
      if (scopedError) throw scopedError;
      const ids = (scopedWarehouses ?? []).map((row) => row.id);
      query = ids.length
        ? query.or(`from_warehouse_id.in.(${ids.join(',')}),to_warehouse_id.in.(${ids.join(',')})`)
        : query.in('from_warehouse_id', ['00000000-0000-0000-0000-000000000000']);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const transferIds = (data ?? []).map((row) => String(row.id));
    const batchIds = [...new Set((data ?? []).map((row) => extractBatchId(row.notes)).filter(Boolean))];
    const warehouseIds = [
      ...new Set(
        (data ?? [])
          .flatMap((row) => [row.from_warehouse_id, row.to_warehouse_id])
          .map((id) => String(id ?? ''))
          .filter(Boolean),
      ),
    ];

    const [batchesResult, warehousesResult, transferItemsResult] = await Promise.all([
      batchIds.length
        ? service.from('production_batches').select('id, batch_number, actual_output').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      warehouseIds.length
        ? service.from('warehouses').select('id, name, code').in('id', warehouseIds)
        : Promise.resolve({ data: [], error: null }),
      transferIds.length
        ? service.from('stock_transfer_items').select('transfer_id, quantity_requested, quantity_sent, quantity_received').in('transfer_id', transferIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (batchesResult.error) throw batchesResult.error;
    if (warehousesResult.error) throw warehousesResult.error;
    if (transferItemsResult.error) throw transferItemsResult.error;

    const batchesById = new Map((batchesResult.data ?? []).map((row) => [String(row.id), row]));
    const warehousesById = new Map((warehousesResult.data ?? []).map((row) => [String(row.id), row]));
    const quantitiesByTransferId = new Map<string, number>();
    for (const transferItem of transferItemsResult.data ?? []) {
      const transferId = String(transferItem.transfer_id ?? '');
      const quantity = Number(
        transferItem.quantity_sent
          ?? transferItem.quantity_received
          ?? transferItem.quantity_requested
          ?? 0,
      );
      quantitiesByTransferId.set(transferId, (quantitiesByTransferId.get(transferId) ?? 0) + quantity);
    }

    return NextResponse.json((data ?? []).map((row) => ({
      ...row,
      batch: batchesById.get(extractBatchId(row.notes) ?? '') ?? null,
      destinationWarehouse: warehousesById.get(String(row.to_warehouse_id ?? '')) ?? null,
      production_batch_id: extractBatchId(row.notes),
      quantity_transferred: quantitiesByTransferId.get(String(row.id)) ?? 0,
      sourceWarehouse: warehousesById.get(String(row.from_warehouse_id ?? '')) ?? null,
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

function extractBatchId(notes: unknown) {
  const match = String(notes ?? '').match(/\[production_batch:([^\]]+)\]/);
  return match?.[1] ?? null;
}
