import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { STOCK_IN_MOVEMENT_TYPES, STOCK_OUT_MOVEMENT_TYPES, toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const itemId = searchParams.get('itemId') ?? '';
  const movementType = searchParams.get('movementType') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';

  try {
    let query = service
      .from('stock_movements')
      .select(
        `id, movement_type, quantity, unit_cost, total_cost, reference_id, reference_type, notes, created_at,
         items!item_id(id, code, name, item_type),
         warehouses!warehouse_id(id, code, name, branch_id, branches!branch_id(id, code, name))`,
      )
      .order('created_at', { ascending: false });

    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    if (itemId) query = query.eq('item_id', itemId);
    if (movementType) query = query.eq('movement_type', movementType);
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    if (ctx.isBranchScoped && ctx.branchId) query = query.eq('warehouses.branch_id', ctx.branchId);

    const { data, error } = await query;
    if (error) return serverError(error.message);

    const rows = (data ?? []).map((movement) => {
      const item = Array.isArray(movement.items) ? movement.items[0] : movement.items;
      const warehouse = Array.isArray(movement.warehouses) ? movement.warehouses[0] : movement.warehouses;
      const branch = Array.isArray(warehouse?.branches) ? warehouse.branches[0] : warehouse?.branches;
      const quantity = toNumber(movement.quantity);

      return {
        createdAt: movement.created_at,
        itemCode: item?.code ?? '',
        itemName: item?.name ?? 'Unknown item',
        itemType: item?.item_type ?? '',
        movementType: movement.movement_type,
        quantityIn: STOCK_IN_MOVEMENT_TYPES.has(String(movement.movement_type)) ? quantity : 0,
        quantityOut: STOCK_OUT_MOVEMENT_TYPES.has(String(movement.movement_type)) ? quantity : 0,
        referenceId: movement.reference_id,
        referenceType: movement.reference_type,
        notes: movement.notes ?? null,
        unitCost: toNumber(movement.unit_cost),
        totalCost: toNumber(movement.total_cost),
        warehouseCode: warehouse?.code ?? '',
        warehouseName: warehouse?.name ?? 'Unknown warehouse',
        branchName: branch?.name ?? null,
      };
    });

    return NextResponse.json({
      data: rows,
      summary: {
        totalIn: rows.reduce((sum, row) => sum + row.quantityIn, 0),
        totalOut: rows.reduce((sum, row) => sum + row.quantityOut, 0),
        totalValue: rows.reduce((sum, row) => sum + row.totalCost, 0),
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load stock movement report');
  }
}
