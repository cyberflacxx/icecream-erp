import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildOpeningClosingRows } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'finance.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const warehouseId = searchParams.get('warehouseId') ?? '';

  let query = service
    .from('stock_movements')
    .select(
      `item_id, warehouse_id, movement_type, quantity, unit_cost, created_at,
       items!item_id(code, name, item_type, unit_cost),
       warehouses!warehouse_id(name, branch_id)`,
    )
    .order('created_at', { ascending: true });

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
  if (ctx.isBranchScoped && ctx.branchId) query = query.eq('warehouses.branch_id', ctx.branchId);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const rows = buildOpeningClosingRows(
    (data ?? []) as Array<Record<string, unknown>>,
    startDate,
    endDate,
  );

  return NextResponse.json({
    data: rows,
    summary: {
      totalClosingStockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
      totalLines: rows.length,
    },
  });
}
