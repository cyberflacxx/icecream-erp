import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'finance.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const itemType = searchParams.get('itemType') ?? '';

  let query = service
    .from('stock_balances')
    .select(
      `quantity_on_hand, quantity_available, quantity, total_value, average_cost, avg_cost,
       items!item_id(id, code, name, item_type, unit_cost, purchase_price, cost_price),
       warehouses!warehouse_id(id, code, name, branch_id, branches!branch_id(id, code, name))`,
    )
    .order('warehouses(name)', { ascending: true })
    .order('items(name)', { ascending: true });

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (itemType) query = query.eq('items.item_type', itemType);
  if (ctx.isBranchScoped && ctx.branchId) query = query.eq('warehouses.branch_id', ctx.branchId);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const rows = (data ?? []).map((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
    const branch = Array.isArray(warehouse?.branches) ? warehouse.branches[0] : warehouse?.branches;
    const quantityOnHand = toNumber(row.quantity_on_hand ?? row.quantity);
    const unitCost = toNumber(row.average_cost ?? row.avg_cost ?? item?.unit_cost ?? item?.cost_price ?? item?.purchase_price);
    const stockValue = toNumber(row.total_value ?? (quantityOnHand * unitCost));

    return {
      branchName: branch?.name ?? null,
      itemCode: item?.code ?? '',
      itemName: item?.name ?? 'Unknown item',
      itemType: item?.item_type ?? '',
      quantityAvailable: toNumber(row.quantity_available),
      quantityOnHand,
      stockValue,
      unitCost,
      warehouseCode: warehouse?.code ?? '',
      warehouseName: warehouse?.name ?? 'Unknown warehouse',
    };
  });

  return NextResponse.json({
    data: rows,
    summary: {
      totalStockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
      totalSkus: rows.length,
    },
  });
}
