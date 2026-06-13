import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { deriveSupplierShortages, summarizeInventoryByType, toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  void request;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [
      balancesResult,
      lowStockResult,
      expiringResult,
      movementsResult,
      purchaseOrdersResult,
      approvalsResult,
    ] = await Promise.all([
      service
        .from('stock_balances')
        .select('quantity_on_hand, items!item_id(item_type, unit_cost)'),
      service
        .from('stock_balances')
        .select('quantity_available, items!item_id(reorder_level)')
        .not('items.reorder_level', 'is', null),
      service
        .from('inventory_batches')
        .select('id')
        .gte('expiry_date', today.toISOString())
        .lte('expiry_date', new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .gt('quantity_remaining', 0),
      service
        .from('stock_movements')
        .select(
          `id, movement_type, quantity, created_at, reference_type, reference_id,
           items!item_id(id, code, name),
           warehouses!warehouse_id(id, name)`,
        )
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
      service
        .from('purchase_orders')
        .select(
          `id, po_number, expected_delivery_date, suppliers(id, name),
           purchase_order_items(item_id, quantity_ordered, quantity_received, items(id, code, name))`,
        )
        .in('status', ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED']),
      service
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .in('entity_type', ['stock_transfer', 'stock_adjustment', 'branch_transfer', 'goods_return']),
    ]);

    if (balancesResult.error) return serverError(balancesResult.error.message);
    if (lowStockResult.error) return serverError(lowStockResult.error.message);
    if (expiringResult.error) return serverError(expiringResult.error.message);
    if (movementsResult.error) return serverError(movementsResult.error.message);
    if (purchaseOrdersResult.error) return serverError(purchaseOrdersResult.error.message);
    if (approvalsResult.error) return serverError(approvalsResult.error.message);

    const lowStockCount = (lowStockResult.data ?? []).filter((row) => {
      const item = Array.isArray(row.items) ? row.items[0] : row.items;
      return toNumber(row.quantity_available) <= toNumber(item?.reorder_level) && toNumber(item?.reorder_level) > 0;
    }).length;

    const shortages = deriveSupplierShortages(
      (purchaseOrdersResult.data ?? []) as Array<Record<string, unknown>>,
    );
    const stockValueSummary = summarizeInventoryByType(
      (balancesResult.data ?? []) as Array<Record<string, unknown>>,
    );

    const todaysMovements = (movementsResult.data ?? []).map((movement) => {
      const item = Array.isArray(movement.items) ? movement.items[0] : movement.items;
      const warehouse = Array.isArray(movement.warehouses) ? movement.warehouses[0] : movement.warehouses;

      return {
        id: movement.id,
        createdAt: movement.created_at,
        itemName: item?.name ?? 'Unknown item',
        movementType: movement.movement_type,
        quantity: toNumber(movement.quantity),
        referenceId: movement.reference_id,
        referenceType: movement.reference_type,
        warehouseName: warehouse?.name ?? 'Unknown warehouse',
      };
    });

    return NextResponse.json({
      ...stockValueSummary,
      expiringSoonCount: expiringResult.data?.length ?? 0,
      lowStockCount,
      pendingApprovalsCount: approvalsResult.count ?? 0,
      supplierShortageCount: shortages.length,
      todaysMovements,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load inventory dashboard');
  }
}
