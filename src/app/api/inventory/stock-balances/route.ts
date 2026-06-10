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
    .select(
      `id, quantity_on_hand, quantity_available, quantity_reserved, last_updated,
       items!item_id(
         id, code, name, item_type, reorder_level,
         units_of_measure!unit_of_measure_id(id, name, abbreviation)
       ),
       warehouses!warehouse_id(
         id, code, name,
         branches!branch_id(id, name)
       )`,
      { count: 'exact' },
    );

  if (itemId) query = query.eq('item_id', itemId);
  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (ctx.isBranchScoped && ctx.branchId) {
    // Filter by warehouses that belong to the branch
    query = query.eq('warehouses.branch_id', ctx.branchId);
  }

  // Fetch without range first if lowStock filter is needed (post-filter)
  // For lowStock we must fetch all and filter in memory then paginate
  if (lowStock) {
    const { data, error } = await query
      .order('warehouses(name)', { ascending: true })
      .order('items(name)', { ascending: true });

    if (error) return serverError(error.message);

    const filtered = (data ?? []).filter((row: Record<string, unknown>) => {
      const rawItems = row.items as { reorder_level?: unknown } | Array<{ reorder_level?: unknown }> | null;
      const items = Array.isArray(rawItems) ? (rawItems[0] ?? null) : rawItems;
      const reorderLevel = Number(items?.reorder_level ?? 0);
      const available = Number(row.quantity_available);
      return reorderLevel > 0 && available <= reorderLevel;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      data: paginated.map(mapBalance),
      pagination: { page, pageSize, total },
    });
  }

  if (itemType) {
    // Can't filter nested column directly with all drivers; add to items filter
    query = query.eq('items.item_type', itemType);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('warehouses(name)', { ascending: true })
    .order('items(name)', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  return NextResponse.json({
    data: (data ?? []).map(mapBalance),
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

function mapBalance(row: Record<string, unknown>) {
  type Obj = Record<string, unknown> | null;
  const rawItems = row.items as Obj | Obj[];
  const items: Obj = Array.isArray(rawItems) ? (rawItems[0] ?? null) : rawItems;
  const rawWH = row.warehouses as Obj | Obj[];
  const warehouses: Obj = Array.isArray(rawWH) ? (rawWH[0] ?? null) : rawWH;
  const rawUoM = items?.units_of_measure as Obj | Obj[] | undefined;
  const unitOfMeasure: Obj = Array.isArray(rawUoM) ? (rawUoM[0] ?? null) : (rawUoM ?? null);
  const rawBranch = warehouses?.branches as Obj | Obj[] | undefined;
  const branch: Obj = Array.isArray(rawBranch) ? (rawBranch[0] ?? null) : (rawBranch ?? null);

  return {
    id: row.id,
    lastUpdated: row.last_updated,
    quantityOnHand: Number(row.quantity_on_hand),
    quantityAvailable: Number(row.quantity_available),
    quantityReserved: Number(row.quantity_reserved),
    item: items
      ? {
          id: items.id,
          code: items.code,
          name: items.name,
          itemType: items.item_type,
          reorderLevel: Number(items.reorder_level ?? 0),
          unitOfMeasure: unitOfMeasure
            ? { id: unitOfMeasure.id, name: unitOfMeasure.name, abbreviation: unitOfMeasure.abbreviation }
            : null,
        }
      : null,
    warehouse: warehouses
      ? {
          id: warehouses.id,
          code: warehouses.code,
          name: warehouses.name,
          branch: branch ? { id: branch.id, name: branch.name } : null,
        }
      : null,
  };
}
