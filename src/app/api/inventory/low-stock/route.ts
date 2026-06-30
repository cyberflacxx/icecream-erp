import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  void request;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const warehousesQuery = service
    .from('warehouses')
    .select('id, code, name, branch_id')
    .eq('organization_id', ctx.organizationId);

  const { data: accessibleWarehouses, error: warehousesError } = ctx.isBranchScoped && ctx.branchId
    ? await warehousesQuery.eq('branch_id', ctx.branchId)
    : await warehousesQuery;
  if (warehousesError) return serverError(warehousesError.message);

  const warehouseIds = (accessibleWarehouses ?? []).map((warehouse) => String(warehouse.id ?? '')).filter(Boolean);
  if (!warehouseIds.length) return NextResponse.json([]);

  const { data: balances, error: balancesError } = await service
    .from('stock_balances')
    .select('id, item_id, warehouse_id, quantity, reserved_qty')
    .in('warehouse_id', warehouseIds);
  if (balancesError) return serverError(balancesError.message);

  const itemIds = [...new Set((balances ?? []).map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const branchIds = [...new Set((accessibleWarehouses ?? []).map((warehouse) => String(warehouse.branch_id ?? '')).filter(Boolean))];

  const [itemsResult, branchesResult] = await Promise.all([
    itemIds.length
      ? service.from('items').select('id, code, name, reorder_level').in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    branchIds.length
      ? service.from('branches').select('id, name').in('id', branchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsResult.error) return serverError(itemsResult.error.message);
  if (branchesResult.error) return serverError(branchesResult.error.message);

  const items = new Map((itemsResult.data ?? []).map((item) => [String(item.id), item]));
  const warehouses = new Map((accessibleWarehouses ?? []).map((warehouse) => [String(warehouse.id), warehouse]));
  const branches = new Map((branchesResult.data ?? []).map((branch) => [String(branch.id), branch]));

  const lowStock = (balances ?? [])
    .map((row) => {
      const item = items.get(String(row.item_id ?? '')) ?? null;
      const warehouse = warehouses.get(String(row.warehouse_id ?? '')) ?? null;
      const branch = warehouse ? branches.get(String(warehouse.branch_id ?? '')) ?? null : null;
      const quantityOnHand = Number(row.quantity ?? 0);
      const quantityReserved = Number(row.reserved_qty ?? 0);
      const quantityAvailable = quantityOnHand - quantityReserved;
      const reorderLevel = Number(item?.reorder_level ?? 0);

      return {
        id: row.id,
        quantityOnHand,
        quantityAvailable,
        quantityReserved,
        reorderLevel,
        item: item
          ? {
              id: item.id,
              code: item.code,
              name: item.name,
              reorderLevel,
            }
          : null,
        warehouse: warehouse
          ? {
              id: warehouse.id,
              code: warehouse.code,
              name: warehouse.name,
              branch: branch ? { id: branch.id, name: branch.name } : null,
            }
          : null,
      };
    })
    .filter((row) => row.item && row.warehouse && row.reorderLevel > 0 && row.quantityAvailable <= row.reorderLevel);

  return NextResponse.json(lowStock);
}
