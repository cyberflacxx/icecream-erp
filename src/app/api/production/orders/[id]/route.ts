import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { mapProductionConversion, RAW_MATERIAL_PRODUCTION_CATEGORY_CODE } from '@/lib/production-raw-material-conversions';
import { mapProductionRpcError, savePlannedProductionOrder } from '@/lib/production-orders-server';
import {
  isMissingProductionTable,
  productionErrorMessage,
  productionService,
  resolveAuthorizedProductionUpdateBranchId,
} from '@/lib/production-server';

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
      service
        .from('production_issues')
        .select(`
          *,
          production_warehouse:warehouses!production_issues_production_warehouse_id_fkey(id, name, code),
          issued_by_user:users!production_issues_issued_by_fkey(id, full_name, first_name, last_name),
          reversed_by_user:users!production_issues_reversed_by_fkey(id, full_name, first_name, last_name),
          lines:production_issue_lines(*)
        `)
        .eq('production_order_id', id)
        .order('issue_date', { ascending: false }),
      service
        .from('production_receipts')
        .select(`
          *,
          finished_goods_warehouse:warehouses!production_receipts_finished_goods_warehouse_id_fkey(id, name, code),
          received_by_user:users!production_receipts_received_by_fkey(id, full_name, first_name, last_name),
          reversed_by_user:users!production_receipts_reversed_by_fkey(id, full_name, first_name, last_name),
          lines:production_receipt_lines(*)
        `)
        .eq('production_order_id', id)
        .order('receipt_date', { ascending: false }),
      service.from('production_order_relationship_map').select('*').eq('production_order_id', id).order('sort_order'),
      service.from('production_order_status_history').select('*').eq('production_order_id', id).order('changed_at', { ascending: false }),
      service.from('production_order_cost_summary').select('*').eq('production_order_id', id).maybeSingle(),
    ]);

    for (const result of [components, issues, receipts, relationshipMap, history, costs]) {
      if (result.error) throw result.error;
    }

    const rawComponents = (components.data ?? []) as Array<Record<string, unknown>>;
    const componentItemIds = [...new Set(
      rawComponents.map((component) => String(component.component_item_id ?? '')).filter(Boolean),
    )];

    let enrichedComponents = rawComponents;
    if (componentItemIds.length) {
      const itemsResult = await service
        .from('items')
        .select('id, category_id, unit_of_measure_id')
        .eq('organization_id', ctx.organizationId)
        .in('id', componentItemIds);
      if (itemsResult.error) throw itemsResult.error;

      const categoryIds = [...new Set(
        (itemsResult.data ?? []).map((item) => String(item.category_id ?? '')).filter(Boolean),
      )];

      const [categoriesResult, profilesResult] = await Promise.all([
        categoryIds.length
          ? service.from('item_categories').select('id, code').in('id', categoryIds)
          : Promise.resolve({ data: [], error: null }),
        service
          .from('production_raw_material_conversions')
          .select('id, item_id, purchase_uom_id, purchase_quantity, conversion_uom_id, conversion_quantity, production_output_uom_id, production_output_quantity, is_active')
          .eq('organization_id', ctx.organizationId)
          .eq('is_active', true)
          .in('item_id', componentItemIds),
      ]);
      if (categoriesResult.error) throw categoriesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const items = new Map(
        (itemsResult.data ?? []).map((item) => [String(item.id), item as Record<string, unknown>]),
      );
      const categories = new Map(
        (categoriesResult.data ?? []).map((category) => [String(category.id), category as Record<string, unknown>]),
      );
      const profiles = new Map(
        (profilesResult.data ?? []).map((profile) => [String(profile.item_id), profile as Record<string, unknown>]),
      );

      const unitIds = [...new Set([
        ...(itemsResult.data ?? []).map((item) => String(item.unit_of_measure_id ?? '')).filter(Boolean),
        ...(profilesResult.data ?? []).flatMap((profile) => [
          String(profile.purchase_uom_id ?? ''),
          String(profile.conversion_uom_id ?? ''),
          String(profile.production_output_uom_id ?? ''),
        ]).filter(Boolean),
      ])];

      const warehouseIds = [...new Set(
        rawComponents
          .map((component) => String(component.warehouse_id ?? order.production_warehouse_id ?? ''))
          .filter(Boolean),
      )];

      const [unitsResult, balancesResult] = await Promise.all([
        unitIds.length
          ? service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
          : Promise.resolve({ data: [], error: null }),
        warehouseIds.length
          ? service
            .from('stock_balances')
            .select('item_id, warehouse_id, quantity_on_hand, quantity_reserved, quantity_available')
            .eq('organization_id', ctx.organizationId)
            .in('item_id', componentItemIds)
            .in('warehouse_id', warehouseIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (unitsResult.error) throw unitsResult.error;
      if (balancesResult.error) throw balancesResult.error;

      const units = new Map(
        (unitsResult.data ?? []).map((unit) => [String(unit.id), unit as Record<string, unknown>]),
      );
      const balances = new Map(
        (balancesResult.data ?? []).map((balance) => [
          `${String(balance.item_id)}:${String(balance.warehouse_id)}`,
          balance as Record<string, unknown>,
        ]),
      );

      enrichedComponents = rawComponents.map((component) => {
        const itemId = String(component.component_item_id ?? '');
        const item = items.get(itemId) ?? null;
        const category = item ? categories.get(String(item.category_id ?? '')) ?? null : null;
        const categoryCode = String(category?.code ?? '');
        const rawProfile = profiles.get(itemId) ?? null;
        const productionConversion = categoryCode === RAW_MATERIAL_PRODUCTION_CATEGORY_CODE && rawProfile
          ? mapProductionConversion(rawProfile, units)
          : null;

        const warehouseId = String(component.warehouse_id ?? order.production_warehouse_id ?? '');
        const balance = balances.get(`${itemId}:${warehouseId}`) ?? null;
        const quantityOnHand = Number(balance?.quantity_on_hand ?? 0);
        const quantityReserved = Number(balance?.quantity_reserved ?? 0);
        const availableQuantity = Number(
          balance?.quantity_available ?? (quantityOnHand - quantityReserved),
        );
        const baseUom = item ? units.get(String(item.unit_of_measure_id ?? '')) ?? null : null;

        return {
          ...component,
          availableBaseStock: balance
            ? {
                quantity: availableQuantity,
                uom: baseUom
                  ? {
                      abbreviation: String(baseUom.abbreviation ?? ''),
                      id: String(baseUom.id ?? ''),
                      name: String(baseUom.name ?? ''),
                    }
                  : null,
              }
            : null,
          categoryCode: categoryCode || null,
          productionConversion,
        };
      });
    }

    return NextResponse.json({
      order,
      components: enrichedComponents,
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
    const requestedBranchId = Object.prototype.hasOwnProperty.call(body, 'branchId')
      ? (body.branchId ?? null)
      : undefined;
    const branchAuthorization = await resolveAuthorizedProductionUpdateBranchId({
      ctx,
      orderId: id,
      requestedBranchId,
    });
    if (!branchAuthorization.ok) {
      return NextResponse.json({ error: branchAuthorization.message }, { status: branchAuthorization.status });
    }

    if (!body.productId) return badRequest('productId is required.');
    if (!body.productionWarehouseId) return badRequest('productionWarehouseId is required.');
    if (!body.finishedGoodsWarehouseId) return badRequest('finishedGoodsWarehouseId is required.');
    const plannedQuantity = ensurePositiveQuantity(body.plannedQuantity, 'plannedQuantity');

    const result = await savePlannedProductionOrder({
      branchId: branchAuthorization.value.branchId,
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
