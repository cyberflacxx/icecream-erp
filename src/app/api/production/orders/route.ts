import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { mapProductionRpcError, savePlannedProductionOrder } from '@/lib/production-orders-server';
import { isMissingProductionTable, productionErrorMessage, productionService } from '@/lib/production-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.view')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const service = productionService();

    let query = service
      .from('production_orders')
      .select(`
        id, production_order_number, product_number, product_description_snapshot, status,
        planned_quantity, released_quantity, completed_quantity, rejected_quantity, remaining_quantity,
        planned_start_date, planned_due_date, production_warehouse_id, finished_goods_warehouse_id,
        created_by, updated_at, created_at,
        production_warehouse:warehouses!production_orders_production_warehouse_id_fkey(name, branch_id),
        finished_goods_warehouse:warehouses!production_orders_finished_goods_warehouse_id_fkey(name)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('updated_at', { ascending: false });

    if (status) query = query.eq('status', status.toUpperCase());
    if (search) {
      query = query.or(`production_order_number.ilike.%${search}%,product_number.ilike.%${search}%,product_description_snapshot.ilike.%${search}%`);
    }
    if (ctx.isBranchScoped && ctx.branchId) query = query.eq('branch_id', ctx.branchId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingProductionTable(err)) return NextResponse.json([]);
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.create')) return forbidden();

  try {
    const body = await request.json() as {
      branchId?: string | null;
      finishedGoodsWarehouseId?: string;
      plannedDueDate?: string | null;
      plannedQuantity?: number;
      plannedStartDate?: string | null;
      priority?: string | null;
      productId?: string;
      productionWarehouseId?: string;
      remarks?: string | null;
    };

    if (!body.productId) return badRequest('productId is required.');
    if (!body.productionWarehouseId) return badRequest('productionWarehouseId is required.');
    if (!body.finishedGoodsWarehouseId) return badRequest('finishedGoodsWarehouseId is required.');
    const plannedQuantity = ensurePositiveQuantity(body.plannedQuantity, 'plannedQuantity');

    const result = await savePlannedProductionOrder({
      branchId: body.branchId ?? ctx.branchId,
      finishedGoodsWarehouseId: body.finishedGoodsWarehouseId,
      plannedDueDate: body.plannedDueDate ?? null,
      plannedQuantity,
      plannedStartDate: body.plannedStartDate ?? null,
      priority: body.priority ?? 'NORMAL',
      productId: body.productId,
      productionWarehouseId: body.productionWarehouseId,
      remarks: body.remarks ?? null,
    }, ctx);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
