import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { deriveSupplierShortages, normalizeStockMovementType, summarizeInventoryByType, toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
  return message.includes(`column ${table}.${columnName} does not exist`);
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
  return (
    message.includes(`relation "${relationName}" does not exist`) ||
    message.includes(`Could not find the table 'icecream_erp.${relationName}'`)
  );
}

function isStoresInboundMovement(type: string) {
  return ['PURCHASE_RECEIVE', 'PURCHASE_RECEIPT', 'TRANSFER_IN', 'WAREHOUSE_TRANSFER_IN', 'FINISHED_GOODS_RECEIPT'].includes(type);
}

function isProductionIssueMovement(type: string) {
  return type === 'PRODUCTION_ISSUE';
}

function isProductionReturnMovement(type: string) {
  return type === 'PRODUCTION_RETURN';
}

function isDamageMovement(type: string) {
  return ['DAMAGE', 'WASTAGE', 'DAMAGED_GOODS_TRANSFER', 'EXPIRY_WRITE_OFF'].includes(type);
}

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
        .select(
          `item_id, warehouse_id, quantity, quantity_on_hand, quantity_available,
           items!item_id(id, code, name, type, item_type, standard_cost, unit_cost, reorder_level),
           warehouses!warehouse_id(id, code, name)`,
        ),
      service
        .from('stock_balances')
        .select('quantity_available, quantity_on_hand, quantity, items!item_id(reorder_level)')
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
           notes, items!item_id(id, code, name),
           warehouses!warehouse_id(id, code, name)`,
        )
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
      service
        .from('purchase_orders')
        .select(
          `id, po_number, expected_date, suppliers(id, name),
           purchase_order_items(item_id, quantity, received_qty, items(id, code, name))`,
        )
        .in('status', ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED']),
      service
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .in('entity_type', ['stock_transfer', 'stock_adjustment', 'branch_transfer', 'goods_return']),
    ]);

    const balancesFallbackNeeded = balancesResult.error && isMissingColumnError(balancesResult.error, 'items', 'item_type');
    const effectiveBalancesData = balancesFallbackNeeded
      ? (await service
          .from('stock_balances')
          .select(
            `item_id, warehouse_id, quantity, quantity_on_hand, quantity_available,
             items!item_id(id, code, name, type, standard_cost, unit_cost, reorder_level),
             warehouses!warehouse_id(id, code, name)`,
          )).data
      : balancesResult.data;
    const lowStockData = lowStockResult.error && isMissingColumnError(lowStockResult.error, 'stock_balances', 'quantity_available')
      ? (await service.from('stock_balances').select('quantity, quantity_on_hand, items!item_id(reorder_level)').not('items.reorder_level', 'is', null)).data
      : lowStockResult.data;
    if (
      balancesResult.error &&
      !(
        isMissingColumnError(balancesResult.error, 'items', 'item_type')
      )
    ) return serverError(balancesResult.error.message);
    if (lowStockResult.error && !isMissingColumnError(lowStockResult.error, 'stock_balances', 'quantity_available')) return serverError(lowStockResult.error.message);
    const expiringCount = isMissingRelationError(expiringResult.error, 'inventory_batches')
      ? 0
      : (expiringResult.data?.length ?? 0);
    if (expiringResult.error && !isMissingRelationError(expiringResult.error, 'inventory_batches')) return serverError(expiringResult.error.message);
    if (movementsResult.error) return serverError(movementsResult.error.message);
    if (purchaseOrdersResult.error) return serverError(purchaseOrdersResult.error.message);
    if (approvalsResult.error) return serverError(approvalsResult.error.message);

    const lowStockCount = (lowStockData ?? []).filter((row) => {
      const stockRow = row as Record<string, unknown>;
      const relatedItems = stockRow.items as { reorder_level?: number } | Array<{ reorder_level?: number }> | null;
      const item = Array.isArray(relatedItems) ? relatedItems[0] : relatedItems;
      return toNumber(stockRow.quantity_available ?? stockRow.quantity) <= toNumber(item?.reorder_level) && toNumber(item?.reorder_level) > 0;
    }).length;

    const shortages = deriveSupplierShortages(
      (purchaseOrdersResult.data ?? []) as Array<Record<string, unknown>>,
    );
    const stockValueSummary = summarizeInventoryByType(
      (effectiveBalancesData ?? []) as Array<Record<string, unknown>>,
    );

    const todaysMovements = (movementsResult.data ?? []).map((movement) => {
      const item = Array.isArray(movement.items) ? movement.items[0] : movement.items;
      const warehouse = Array.isArray(movement.warehouses) ? movement.warehouses[0] : movement.warehouses;
      const normalizedMovementType = normalizeStockMovementType(String(movement.movement_type ?? ''));

      return {
        id: movement.id,
        createdAt: movement.created_at,
        itemName: item?.name ?? 'Unknown item',
        movementType: normalizedMovementType,
        notes: movement.notes ? String(movement.notes) : null,
        quantity: toNumber(movement.quantity),
        referenceId: movement.reference_id,
        referenceType: movement.reference_type,
        warehouseCode: warehouse?.code ?? null,
        warehouseName: warehouse?.name ?? 'Unknown warehouse',
      };
    });

    const storesSummary = todaysMovements.reduce(
      (accumulator, movement) => {
        if (isStoresInboundMovement(movement.movementType)) {
          accumulator.receivedTodayQuantity += movement.quantity;
        }
        if (isProductionIssueMovement(movement.movementType)) {
          accumulator.movedToProductionTodayQuantity += movement.quantity;
        }
        if (isProductionReturnMovement(movement.movementType)) {
          accumulator.returnedFromProductionTodayQuantity += movement.quantity;
        }
        if (isDamageMovement(movement.movementType)) {
          accumulator.damagedTodayQuantity += movement.quantity;
        }
        return accumulator;
      },
      {
        damagedTodayQuantity: 0,
        movedToProductionTodayQuantity: 0,
        receivedTodayQuantity: 0,
        returnedFromProductionTodayQuantity: 0,
      },
    );

    const stockBalanceByWarehouse = ((effectiveBalancesData ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
        const quantityOnHand = toNumber(row.quantity_on_hand ?? row.quantity);
        const quantityAvailable = toNumber(row.quantity_available ?? quantityOnHand);
        const reorderLevel = toNumber(item?.reorder_level);

        return {
          availableQuantity: quantityAvailable,
          isLowStock: reorderLevel > 0 && quantityAvailable <= reorderLevel,
          itemCode: item?.code ?? '',
          itemId: row.item_id ? String(row.item_id) : '',
          itemName: item?.name ?? 'Unknown item',
          quantityOnHand,
          reorderLevel,
          warehouseCode: warehouse?.code ?? '',
          warehouseId: row.warehouse_id ? String(row.warehouse_id) : '',
          warehouseName: warehouse?.name ?? 'Unknown warehouse',
        };
      })
      .sort((left, right) => {
        if (left.isLowStock !== right.isLowStock) {
          return left.isLowStock ? -1 : 1;
        }
        return right.quantityOnHand - left.quantityOnHand;
      })
      .slice(0, 12);

    return NextResponse.json({
      ...stockValueSummary,
      currentStockQuantity: ((effectiveBalancesData ?? []) as Array<Record<string, unknown>>)
        .reduce((sum, row) => sum + toNumber(row.quantity_on_hand ?? row.quantity), 0),
      damagedTodayQuantity: storesSummary.damagedTodayQuantity,
      expiringSoonCount: expiringCount,
      lowStockCount,
      movedToProductionTodayQuantity: storesSummary.movedToProductionTodayQuantity,
      pendingApprovalsCount: approvalsResult.count ?? 0,
      receivedTodayQuantity: storesSummary.receivedTodayQuantity,
      returnedFromProductionTodayQuantity: storesSummary.returnedFromProductionTodayQuantity,
      stockBalanceByWarehouse,
      supplierShortageCount: shortages.length,
      todaysMovements,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load inventory dashboard');
  }
}
