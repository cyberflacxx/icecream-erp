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

    type BalanceRow = {
      id: string;
      quantity_on_hand: number;
      quantity_available: number;
      quantity_reserved: number;
      last_updated: string | null;
      items: {
        id: string;
        code: string;
        name: string;
        item_type: string;
        reorder_level: number | null;
        units_of_measure: { id: string; name: string; abbreviation: string } | null;
      } | null;
      warehouses: {
        id: string;
        code: string;
        name: string;
        branches: { id: string; name: string } | null;
      } | null;
    };

    const filtered = ((data ?? []) as BalanceRow[]).filter((b) => {
      const reorderLevel = Number(b.items?.reorder_level ?? 0);
      const available = Number(b.quantity_available);
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
    data: ((data ?? []) as Parameters<typeof mapBalance>[0][]).map(mapBalance),
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

function mapBalance(b: {
  id: string;
  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
  last_updated: string | null;
  items: {
    id: string;
    code: string;
    name: string;
    item_type: string;
    reorder_level: number | null;
    units_of_measure: { id: string; name: string; abbreviation: string } | null;
  } | null;
  warehouses: {
    id: string;
    code: string;
    name: string;
    branches: { id: string; name: string } | null;
  } | null;
}) {
  return {
    id: b.id,
    lastUpdated: b.last_updated,
    quantityOnHand: Number(b.quantity_on_hand),
    quantityAvailable: Number(b.quantity_available),
    quantityReserved: Number(b.quantity_reserved),
    item: b.items
      ? {
          id: b.items.id,
          code: b.items.code,
          name: b.items.name,
          itemType: b.items.item_type,
          reorderLevel: Number(b.items.reorder_level ?? 0),
          unitOfMeasure: b.items.units_of_measure
            ? {
                id: b.items.units_of_measure.id,
                name: b.items.units_of_measure.name,
                abbreviation: b.items.units_of_measure.abbreviation,
              }
            : null,
        }
      : null,
    warehouse: b.warehouses
      ? {
          id: b.warehouses.id,
          code: b.warehouses.code,
          name: b.warehouses.name,
          branch: b.warehouses.branches
            ? { id: b.warehouses.branches.id, name: b.warehouses.branches.name }
            : null,
        }
      : null,
  };
}
