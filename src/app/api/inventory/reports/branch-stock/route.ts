import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const branchId = ctx.isBranchScoped && ctx.branchId
    ? ctx.branchId
    : (searchParams.get('branchId') ?? '');

  let query = service
    .from('stock_balances')
    .select(
      `quantity_on_hand, quantity_available,
       items!item_id(code, name, item_type, unit_cost),
       warehouses!warehouse_id(code, name, branch_id, branches!branch_id(id, code, name))`,
    )
    .order('warehouses(name)', { ascending: true })
    .order('items(name)', { ascending: true });

  if (branchId) query = query.eq('warehouses.branch_id', branchId);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const rows = (data ?? []).map((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
    const branch = Array.isArray(warehouse?.branches) ? warehouse.branches[0] : warehouse?.branches;
    const quantityOnHand = toNumber(row.quantity_on_hand);
    const unitCost = toNumber(item?.unit_cost);

    return {
      branchCode: branch?.code ?? '',
      branchName: branch?.name ?? null,
      itemCode: item?.code ?? '',
      itemName: item?.name ?? 'Unknown item',
      itemType: item?.item_type ?? '',
      quantityAvailable: toNumber(row.quantity_available),
      quantityOnHand,
      stockValue: quantityOnHand * unitCost,
      warehouseCode: warehouse?.code ?? '',
      warehouseName: warehouse?.name ?? 'Unknown warehouse',
    };
  });

  return NextResponse.json({
    data: rows,
    summary: {
      branches: new Set(rows.map((row) => row.branchCode).filter(Boolean)).size,
      totalStockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
    },
  });
}
