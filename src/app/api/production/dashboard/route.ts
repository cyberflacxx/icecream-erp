import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildProductionOrdersDashboard } from '@/lib/production';
import { productionErrorMessage, productionService } from '@/lib/production-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId');
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;

    let ordersQuery = service
      .from('production_orders')
      .select(`
        id,
        branch_id,
        status,
        production_order_number,
        product_number,
        product_description_snapshot,
        planned_cost,
        actual_cost,
        released_quantity,
        completed_quantity,
        remaining_quantity,
        updated_at
      `)
      .eq('organization_id', ctx.organizationId)
      .order('updated_at', { ascending: false });

    if (branchId) {
      ordersQuery = ordersQuery.eq('branch_id', branchId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) throw ordersError;

    const orderRows = (orders ?? []) as Array<Record<string, unknown>>;
    const orderIds = orderRows.map((row) => String(row.id ?? '')).filter(Boolean);

    if (orderIds.length === 0) {
      return NextResponse.json(buildProductionOrdersDashboard({
        components: [],
        costs: [],
        issues: [],
        orders: [],
        receipts: [],
      }));
    }

    const [componentsResult, issuesResult, receiptsResult, costsResult] = await Promise.all([
      service
        .from('production_order_components')
        .select('production_order_id, released_quantity, issued_quantity, shortage_quantity')
        .in('production_order_id', orderIds),
      service
        .from('production_issues')
        .select(`
          id,
          production_order_id,
          issue_number,
          issue_date,
          posting_status,
          total_quantity,
          production_warehouse:warehouses!production_issues_production_warehouse_id_fkey(name)
        `)
        .in('production_order_id', orderIds)
        .order('issue_date', { ascending: false })
        .limit(8),
      service
        .from('production_receipts')
        .select(`
          id,
          production_order_id,
          receipt_number,
          receipt_date,
          posting_status,
          total_completed_quantity,
          finished_goods_warehouse:warehouses!production_receipts_finished_goods_warehouse_id_fkey(name)
        `)
        .in('production_order_id', orderIds)
        .order('receipt_date', { ascending: false })
        .limit(8),
      service
        .from('production_order_cost_summary')
        .select('production_order_id, planned_cost, actual_cost, cost_variance')
        .in('production_order_id', orderIds),
    ]);

    for (const result of [componentsResult, issuesResult, receiptsResult, costsResult]) {
      if (result.error) throw result.error;
    }

    const issues = (issuesResult.data ?? []).map((row) => ({
      ...row,
      warehouse_name: (Array.isArray(row.production_warehouse) ? row.production_warehouse[0] : row.production_warehouse)?.name ?? null,
    }));
    const receipts = (receiptsResult.data ?? []).map((row) => ({
      ...row,
      warehouse_name: (Array.isArray(row.finished_goods_warehouse) ? row.finished_goods_warehouse[0] : row.finished_goods_warehouse)?.name ?? null,
    }));

    return NextResponse.json(buildProductionOrdersDashboard({
      components: (componentsResult.data ?? []) as Array<Record<string, unknown>>,
      costs: (costsResult.data ?? []) as Array<Record<string, unknown>>,
      issues: issues as Array<Record<string, unknown>>,
      orders: orderRows,
      receipts: receipts as Array<Record<string, unknown>>,
    }));
  } catch (err) {
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}
