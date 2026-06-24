import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const itemId = searchParams.get('itemId') ?? '';
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const itemType = searchParams.get('itemType') ?? '';
  const lowStock = searchParams.get('lowStock') === 'true';

  let query = service
    .from('stock_balances')
    .select('id, item_id, warehouse_id, quantity, reserved_qty, avg_cost, updated_at', { count: 'exact' })
    .eq('organization_id', ctx.organizationId);

  if (itemId) query = query.eq('item_id', itemId);
  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (ctx.isBranchScoped && ctx.branchId) {
    // Filter by warehouses that belong to the branch
    query = query.eq('warehouses.branch_id', ctx.branchId);
  }

  // Fetch without range first if lowStock filter is needed (post-filter)
  // For lowStock we must fetch all and filter in memory then paginate
  if (lowStock) {
    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) return serverError(error.message);

    const filtered = (data ?? []).filter((row: Record<string, unknown>) => {
      const reorderLevel = 0;
      const available = Number(row.quantity ?? 0) - Number(row.reserved_qty ?? 0);
      return reorderLevel > 0 && available <= reorderLevel;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return NextResponse.json({
        data: await mapBalances(service, paginated),
      pagination: { page, pageSize, total },
    });
  }

  if (itemType) {
    // Can't filter nested column directly with all drivers; add to items filter
    const { data: typeItems, error: typeItemsError } = await service
      .from('items')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('type', itemType);
    if (typeItemsError) return serverError(typeItemsError.message);
    const ids = (typeItems ?? []).map((row) => row.id);
    query = ids.length ? query.in('item_id', ids) : query.in('item_id', ['00000000-0000-0000-0000-000000000000']);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  return NextResponse.json({
    data: await mapBalances(service, (data ?? []) as Array<Record<string, unknown>>),
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

async function mapBalances(service: ReturnType<typeof createServiceRoleClient>, rows: Array<Record<string, unknown>>) {
  const itemIds = [...new Set(rows.map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const warehouseIds = [...new Set(rows.map((row) => String(row.warehouse_id ?? '')).filter(Boolean))];
  const [itemsResult, warehousesResult] = await Promise.all([
    itemIds.length ? service.from('items').select('id, code, name, type, reorder_level, unit_id').in('id', itemIds) : Promise.resolve({ data: [], error: null }),
    warehouseIds.length ? service.from('warehouses').select('id, code, name, branch_id').in('id', warehouseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (warehousesResult.error) throw new Error(warehousesResult.error.message);

  const unitIds = [...new Set((itemsResult.data ?? []).map((item) => String(item.unit_id ?? '')).filter(Boolean))];
  const branchIds = [...new Set((warehousesResult.data ?? []).map((warehouse) => String(warehouse.branch_id ?? '')).filter(Boolean))];
  const [unitsResult, branchesResult] = await Promise.all([
    unitIds.length ? service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds) : Promise.resolve({ data: [], error: null }),
    branchIds.length ? service.from('branches').select('id, name').in('id', branchIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (unitsResult.error) throw new Error(unitsResult.error.message);
  if (branchesResult.error) throw new Error(branchesResult.error.message);

  const items = new Map((itemsResult.data ?? []).map((item) => [String(item.id), item as Record<string, unknown>]));
  const warehouses = new Map((warehousesResult.data ?? []).map((warehouse) => [String(warehouse.id), warehouse as Record<string, unknown>]));
  const units = new Map((unitsResult.data ?? []).map((unit) => [String(unit.id), unit as Record<string, unknown>]));
  const branches = new Map((branchesResult.data ?? []).map((branch) => [String(branch.id), branch as Record<string, unknown>]));

  return rows.map((row) => {
    const item = items.get(String(row.item_id ?? '')) ?? null;
    const warehouse = warehouses.get(String(row.warehouse_id ?? '')) ?? null;
    const unitOfMeasure = item ? units.get(String(item.unit_id ?? '')) ?? null : null;
    const branch = warehouse ? branches.get(String(warehouse.branch_id ?? '')) ?? null : null;
    const quantityOnHand = Number(row.quantity ?? 0);
    const quantityReserved = Number(row.reserved_qty ?? 0);
    return {
    id: row.id,
    lastUpdated: row.updated_at,
    quantityOnHand,
    quantityAvailable: quantityOnHand - quantityReserved,
    quantityReserved,
    item: item
      ? {
          id: item.id,
          code: item.code,
          name: item.name,
          itemType: item.type,
          reorderLevel: Number(item.reorder_level ?? 0),
          unitOfMeasure: unitOfMeasure
            ? { id: unitOfMeasure.id, name: unitOfMeasure.name, abbreviation: unitOfMeasure.abbreviation }
            : null,
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
  });
}
