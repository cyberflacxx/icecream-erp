import { NextRequest, NextResponse } from 'next/server';

import { type AuthContext, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  deriveSupplierShortages,
  isPendingInventoryApprovalStatus,
  normalizeStockMovementType,
  summarizeInventoryByType,
  toNumber,
} from '@/lib/inventory';
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

const NO_WAREHOUSE_SCOPE = ['00000000-0000-0000-0000-000000000000'];
const INVENTORY_APPROVAL_ENTITY_TYPES = [
  'stock_transfer',
  'stock_adjustment',
  'branch_transfer',
  'goods_return',
  'stock_take',
  'inventory_stock_take',
  'production_material_issue',
  'raw_material_request',
  'finished_goods_transfer',
  'inventory_write_off',
];

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function hasGlobalInventoryScope(ctx: AuthContext) {
  return ctx.permissions.includes('view_all_branches') || ctx.permissions.includes('settings.manage');
}

function isInventoryApprovalRow(row: Record<string, unknown>) {
  const entityType = String(row.entity_type ?? '').toLowerCase();
  const moduleName = String(row.module_name ?? '').toLowerCase();
  const documentType = String(row.document_type ?? '').toLowerCase();

  return (
    moduleName === 'inventory' ||
    INVENTORY_APPROVAL_ENTITY_TYPES.includes(entityType) ||
    INVENTORY_APPROVAL_ENTITY_TYPES.includes(entityType.replace(/^inventory\./, '')) ||
    INVENTORY_APPROVAL_ENTITY_TYPES.includes(documentType)
  );
}

async function resolveWarehouseScope(service: ServiceClient, ctx: AuthContext) {
  if (hasGlobalInventoryScope(ctx) && ctx.warehouseAssignments.length === 0) return null;

  const warehouseIds = new Set(ctx.warehouseAssignments);
  const branchIds = [...new Set([ctx.branchId, ...ctx.branchAssignments].filter(Boolean).map(String))];

  if (branchIds.length) {
    const { data, error } = await service
      .from('warehouses')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .in('branch_id', branchIds);

    if (error) throw error;
    for (const warehouse of data ?? []) {
      warehouseIds.add(String(warehouse.id));
    }
  }

  return warehouseIds.size ? [...warehouseIds] : NO_WAREHOUSE_SCOPE;
}

function applyWarehouseScope(
  query: any,
  warehouseIds: string[] | null,
  column = 'warehouse_id',
) {
  return warehouseIds ? query.in(column, warehouseIds) : query;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const warehouseScope = await resolveWarehouseScope(service, ctx);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const balanceSelect = `item_id, warehouse_id, quantity, quantity_on_hand, quantity_available, total_value, average_cost, avg_cost,
           items!item_id(id, code, name, type, item_type, standard_cost, unit_cost, reorder_level),
           warehouses!warehouse_id(id, code, name, is_active)`;
    const fallbackBalanceSelect = `item_id, warehouse_id, quantity, quantity_on_hand, quantity_available,
           items!item_id(id, code, name, type, standard_cost, unit_cost, reorder_level),
           warehouses!warehouse_id(id, code, name)`;

    const [
      balancesResult,
      lowStockResult,
      expiringResult,
      movementsResult,
      purchaseOrdersResult,
      approvalsResult,
    ] = await Promise.all([
      applyWarehouseScope(service
        .from('stock_balances')
        .select(balanceSelect)
        .eq('organization_id', ctx.organizationId), warehouseScope),
      applyWarehouseScope(service
        .from('stock_balances')
        .select('quantity_available, quantity_on_hand, quantity, items!item_id(reorder_level)')
        .eq('organization_id', ctx.organizationId)
        .not('items.reorder_level', 'is', null), warehouseScope),
      applyWarehouseScope(service
        .from('inventory_batches')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .gte('expiry_date', today.toISOString())
        .lte('expiry_date', new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .gt('quantity_remaining', 0), warehouseScope),
      applyWarehouseScope(service
        .from('stock_movements')
        .select(
          `id, movement_type, quantity, created_at, reference_type, reference_id,
           notes, items!item_id(id, code, name),
           warehouses!warehouse_id(id, code, name)`,
        )
        .eq('organization_id', ctx.organizationId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false })
        .limit(10), warehouseScope),
      service
        .from('purchase_orders')
        .select(
          `id, po_number, expected_date, suppliers(id, name),
           purchase_order_items(item_id, quantity, received_qty, items(id, code, name))`,
        )
        .eq('organization_id', ctx.organizationId)
        .in('status', ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED']),
      service
        .from('approval_requests')
        .select('id, entity_type, module_name, document_type, document_reference, entity_id, status, requested_at, requested_by')
        .eq('organization_id', ctx.organizationId)
    ]);

    const balancesFallbackNeeded = balancesResult.error && (
      isMissingColumnError(balancesResult.error, 'items', 'item_type') ||
      isMissingColumnError(balancesResult.error, 'stock_balances', 'total_value') ||
      isMissingColumnError(balancesResult.error, 'stock_balances', 'average_cost') ||
      isMissingColumnError(balancesResult.error, 'stock_balances', 'avg_cost') ||
      isMissingColumnError(balancesResult.error, 'warehouses', 'is_active')
    );
    const effectiveBalancesData = balancesFallbackNeeded
      ? (await applyWarehouseScope(service
          .from('stock_balances')
          .select(fallbackBalanceSelect)
          .eq('organization_id', ctx.organizationId), warehouseScope)).data
      : balancesResult.data;
    const lowStockData = lowStockResult.error && isMissingColumnError(lowStockResult.error, 'stock_balances', 'quantity_available')
      ? (await applyWarehouseScope(service
          .from('stock_balances')
          .select('quantity, quantity_on_hand, items!item_id(reorder_level)')
          .eq('organization_id', ctx.organizationId)
          .not('items.reorder_level', 'is', null), warehouseScope)).data
      : lowStockResult.data;
    if (
      balancesResult.error &&
      !(
        balancesFallbackNeeded
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

    const lowStockCount = ((lowStockData ?? []) as Array<Record<string, unknown>>).filter((row) => {
      const stockRow = row as Record<string, unknown>;
      const relatedItems = stockRow.items as { reorder_level?: number } | Array<{ reorder_level?: number }> | null;
      const item = Array.isArray(relatedItems) ? relatedItems[0] : relatedItems;
      return toNumber(stockRow.quantity_available ?? stockRow.quantity) <= toNumber(item?.reorder_level) && toNumber(item?.reorder_level) > 0;
    }).length;

    const shortages = deriveSupplierShortages(
      (purchaseOrdersResult.data ?? []) as Array<Record<string, unknown>>,
    );
    const activeBalances = ((effectiveBalancesData ?? []) as Array<Record<string, unknown>>).filter((row) => {
      const relatedWarehouses = row.warehouses as { is_active?: boolean } | Array<{ is_active?: boolean }> | null;
      const warehouse = Array.isArray(relatedWarehouses) ? relatedWarehouses[0] : relatedWarehouses;
      return warehouse?.is_active !== false;
    });
    const stockValueSummary = summarizeInventoryByType(activeBalances);
    const pendingInventoryApprovals = ((approvalsResult.data ?? []) as Array<Record<string, unknown>>)
      .filter(isInventoryApprovalRow)
      .filter((row) => isPendingInventoryApprovalStatus(row.status))
      .sort((left, right) => new Date(String(right.requested_at ?? 0)).getTime() - new Date(String(left.requested_at ?? 0)).getTime());
    const recentApprovals = pendingInventoryApprovals
      .sort((left, right) => new Date(String(right.requested_at ?? 0)).getTime() - new Date(String(left.requested_at ?? 0)).getTime())
      .slice(0, 5)
      .map((row) => ({
        approvalStatus: String(row.status ?? 'PENDING'),
        id: String(row.id),
        referenceNumber: String(row.document_reference ?? row.entity_id ?? row.id),
        requestDate: String(row.requested_at ?? ''),
        requestType: String(row.document_type ?? row.entity_type ?? 'inventory_approval'),
        requestedBy: row.requested_by ? String(row.requested_by) : null,
      }));

    const todaysMovements = ((movementsResult.data ?? []) as Array<Record<string, unknown>>).map((movement) => {
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
      (accumulator: {
        damagedTodayQuantity: number;
        movedToProductionTodayQuantity: number;
        receivedTodayQuantity: number;
        returnedFromProductionTodayQuantity: number;
      }, movement) => {
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

    const stockBalanceByWarehouse = activeBalances
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

    const payload = {
      ...stockValueSummary,
      currentStockQuantity: activeBalances
        .reduce((sum, row) => sum + toNumber(row.quantity_on_hand ?? row.quantity), 0),
      damagedTodayQuantity: storesSummary.damagedTodayQuantity,
      expiringSoonCount: expiringCount,
      lowStockCount,
      movedToProductionTodayQuantity: storesSummary.movedToProductionTodayQuantity,
      pendingApprovalsCount: pendingInventoryApprovals.length,
      receivedTodayQuantity: storesSummary.receivedTodayQuantity,
      recentApprovals,
      returnedFromProductionTodayQuantity: storesSummary.returnedFromProductionTodayQuantity,
      stockBalanceByWarehouse,
      supplierShortageCount: shortages.length,
      todaysMovements,
    };

    return NextResponse.json({
      ...payload,
      success: true,
      data: payload,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load inventory dashboard');
  }
}
