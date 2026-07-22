import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingTableColumnError, resolveInventoryValue } from '@/lib/inventory';
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

  let scopedWarehouseIds: string[] | null = null;
  if (ctx.isBranchScoped && ctx.branchId) {
    const { data: warehouses, error: warehouseError } = await service
      .from('warehouses')
      .select('id')
      .eq('branch_id', ctx.branchId);
    if (warehouseError) return serverError(warehouseError.message);
    scopedWarehouseIds = (warehouses ?? []).map((row) => String(row.id));
  }

  let query = service
    .from('stock_balances')
    .select('id, item_id, warehouse_id, quantity, quantity_on_hand, quantity_reserved, quantity_available, average_cost, avg_cost, total_value, last_updated', { count: 'exact' })
    .eq('organization_id', ctx.organizationId);

  if (itemId) query = query.eq('item_id', itemId);
  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (scopedWarehouseIds) {
    query = scopedWarehouseIds.length
      ? query.in('warehouse_id', scopedWarehouseIds)
      : query.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
  }

  // Fetch without range first if lowStock filter is needed (post-filter)
  // For lowStock we must fetch all and filter in memory then paginate
  if (lowStock) {
    let { data, error } = await query.order('updated_at', { ascending: false });

    if (
      error &&
      (
        isMissingTableColumnError(error, 'stock_balances', 'quantity') ||
        isMissingTableColumnError(error, 'stock_balances', 'average_cost') ||
        isMissingTableColumnError(error, 'stock_balances', 'avg_cost') ||
        isMissingTableColumnError(error, 'stock_balances', 'total_value')
      )
    ) {
      let fallbackQuery = service
        .from('stock_balances')
        .select('id, item_id, warehouse_id, quantity_on_hand, quantity_reserved, quantity_available, last_updated')
        .eq('organization_id', ctx.organizationId);
      if (itemId) fallbackQuery = fallbackQuery.eq('item_id', itemId);
      if (warehouseId) fallbackQuery = fallbackQuery.eq('warehouse_id', warehouseId);
      if (scopedWarehouseIds) {
        fallbackQuery = scopedWarehouseIds.length
          ? fallbackQuery.in('warehouse_id', scopedWarehouseIds)
          : fallbackQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
      }
      const fallback = await fallbackQuery.order('updated_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return serverError(error.message);

    const mapped = await mapBalances(service, (data ?? []) as Array<Record<string, unknown>>);
    const filtered = mapped.filter((row) => {
      const reorderLevel = Number(row.item?.reorderLevel ?? 0);
      const available = Number(row.quantityAvailable ?? 0);
      return reorderLevel > 0 && available <= reorderLevel;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      data: paginated,
      pagination: { page, pageSize, total },
    });
  }

  if (itemType) {
    // Can't filter nested column directly with all drivers; add to items filter
    const { data: typeItems, error: typeItemsError } = await service
      .from('items')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('item_type', itemType);
    if (typeItemsError) return serverError(typeItemsError.message);
    const ids = (typeItems ?? []).map((row) => row.id);
    query = ids.length ? query.in('item_id', ids) : query.in('item_id', ['00000000-0000-0000-0000-000000000000']);
  }

  const from = (page - 1) * pageSize;
  let { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (
    error &&
    (
      isMissingTableColumnError(error, 'stock_balances', 'quantity') ||
      isMissingTableColumnError(error, 'stock_balances', 'average_cost') ||
      isMissingTableColumnError(error, 'stock_balances', 'avg_cost') ||
      isMissingTableColumnError(error, 'stock_balances', 'total_value')
    )
  ) {
    let fallbackQuery = service
      .from('stock_balances')
      .select('id, item_id, warehouse_id, quantity_on_hand, quantity_reserved, quantity_available, last_updated', { count: 'exact' })
      .eq('organization_id', ctx.organizationId);
    if (itemId) fallbackQuery = fallbackQuery.eq('item_id', itemId);
    if (warehouseId) fallbackQuery = fallbackQuery.eq('warehouse_id', warehouseId);
    if (itemType) {
      const { data: typeItems, error: typeItemsError } = await service
        .from('items')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('item_type', itemType);
      if (typeItemsError) return serverError(typeItemsError.message);
      const ids = (typeItems ?? []).map((row) => row.id);
      fallbackQuery = ids.length ? fallbackQuery.in('item_id', ids) : fallbackQuery.in('item_id', ['00000000-0000-0000-0000-000000000000']);
    }
    if (scopedWarehouseIds) {
      fallbackQuery = scopedWarehouseIds.length
        ? fallbackQuery.in('warehouse_id', scopedWarehouseIds)
        : fallbackQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
    }
    const fallback = await fallbackQuery.order('updated_at', { ascending: false }).range(from, from + pageSize - 1);
    data = fallback.data;
    count = fallback.count;
    error = fallback.error;
  }

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
    itemIds.length ? service.from('items').select('id, code, name, item_type, reorder_level, reorder_quantity, reorder_qty, unit_of_measure_id, unit_cost, standard_cost').in('id', itemIds) : Promise.resolve({ data: [], error: null }),
    warehouseIds.length ? service.from('warehouses').select('id, code, name, branch_id').in('id', warehouseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (warehousesResult.error) throw new Error(warehousesResult.error.message);

  const unitIds = [...new Set((itemsResult.data ?? []).map((item) => String(item.unit_of_measure_id ?? '')).filter(Boolean))];
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
    const unitOfMeasure = item ? units.get(String(item.unit_of_measure_id ?? '')) ?? null : null;
    const branch = warehouse ? branches.get(String(warehouse.branch_id ?? '')) ?? null : null;
    const quantityOnHand = Number(row.quantity_on_hand ?? row.quantity ?? 0);
    const quantityReserved = Number(row.quantity_reserved ?? 0);
    const quantityAvailable = Number(row.quantity_available ?? (quantityOnHand - quantityReserved));
    const unitCost = Number(row.average_cost ?? row.avg_cost ?? item?.unit_cost ?? item?.standard_cost ?? 0);
    const stockValue = resolveInventoryValue(row, quantityOnHand * unitCost);
    return {
      id: row.id,
      lastUpdated: row.last_updated,
      quantityOnHand,
      quantityAvailable,
      quantityReserved,
      stockValue,
      item: item
        ? {
            id: item.id,
            code: item.code,
            name: item.name,
            itemType: item.item_type,
            reorderLevel: Number(item.reorder_level ?? 0),
            reorderQuantity: Number(item.reorder_quantity ?? item.reorder_qty ?? 0),
            unitCost,
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
