import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { mapProductionRpcError, savePlannedProductionOrder } from '@/lib/production-orders-server';
import { isMissingProductionTable, productionErrorMessage, productionService } from '@/lib/production-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.view')) return forbidden();

  const { id } = await params;
  const service = productionService();

  try {
    const { data: order, error } = await service
      .from('production_orders')
      .select(`
        *,
        production_warehouse:warehouses!production_orders_production_warehouse_id_fkey(id, name, code, branch_id),
        finished_goods_warehouse:warehouses!production_orders_finished_goods_warehouse_id_fkey(id, name, code),
        product:items!production_orders_product_id_fkey(id, code, name, description, item_type, unit_cost),
        bom:recipes!production_orders_bom_id_fkey(id, code, name, version, expected_output_quantity)
      `)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!order) return notFound('Production order not found.');
    if (ctx.isBranchScoped && ctx.branchId && order.branch_id && order.branch_id !== ctx.branchId) return forbidden();

    const [components, issues, receipts, relationshipMap, history, costs] = await Promise.all([
      service.from('production_order_components').select('*').eq('production_order_id', id).order('created_at'),
      service.from('production_issues').select('*, lines:production_issue_lines(*)').eq('production_order_id', id).order('issue_date', { ascending: false }),
      service.from('production_receipts').select('*, lines:production_receipt_lines(*)').eq('production_order_id', id).order('receipt_date', { ascending: false }),
      service.from('production_order_relationship_map').select('*').eq('production_order_id', id).order('sort_order'),
      service.from('production_order_status_history').select('*').eq('production_order_id', id).order('changed_at', { ascending: false }),
      service.from('production_order_cost_summary').select('*').eq('production_order_id', id).maybeSingle(),
    ]);

    for (const result of [components, issues, receipts, relationshipMap, history, costs]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      order,
      components: components.data ?? [],
      issues: issues.data ?? [],
      receipts: receipts.data ?? [],
      relationshipMap: relationshipMap.data ?? [],
      statusHistory: history.data ?? [],
      costs: costs.data ?? null,
    });
  } catch (err) {
    if (isMissingProductionTable(err)) return notFound('Production order not found.');
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.edit_planned')) return forbidden();

  try {
    const { id } = await params;
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
      orderId: id,
      plannedDueDate: body.plannedDueDate ?? null,
      plannedQuantity,
      plannedStartDate: body.plannedStartDate ?? null,
      priority: body.priority ?? 'NORMAL',
      productId: body.productId,
      productionWarehouseId: body.productionWarehouseId,
      remarks: body.remarks ?? null,
    }, ctx);

    return NextResponse.json(result);
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
