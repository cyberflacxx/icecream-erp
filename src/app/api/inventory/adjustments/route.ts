import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  unauthorized,
} from '@/lib/api-auth';
import {
  resolveInventoryUnitCost,
  resolveInventoryValue,
  toNumber,
} from '@/lib/inventory';
import {
  applyInventoryDelta,
  buildInventoryAdjustmentFailureResponse,
  createInventoryAdjustmentRecord,
  recordStockMovement,
  requireItem,
  requireWarehouseAccess,
  writeInventoryAuditLog,
} from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function inventoryAdjustmentFailedResponse(input: {
  dbMessage?: string | null;
  itemId?: string | null;
  quantity?: number | null;
  stage: string;
  totalValue?: number | null;
  unitCost?: number | null;
  warehouseId?: string | null;
}) {
  return NextResponse.json(buildInventoryAdjustmentFailureResponse(input), { status: 500 });
}

function inventoryAdjustmentSuccessWarningResponse(input: {
  adjustmentId: string;
  itemId: string;
  quantity: number;
  totalValue: number;
  unitCost: number;
  warehouseId: string;
  warning: string;
}) {
  return NextResponse.json(
    {
      adjustmentPosted: true,
      id: input.adjustmentId,
      itemId: input.itemId,
      quantity: input.quantity,
      success: true,
      totalValue: input.totalValue,
      unitCost: input.unitCost,
      warehouseId: input.warehouseId,
      warning: input.warning,
    },
    { status: 201 },
  );
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();
  let stage = 'READ_REQUEST';

  const body = (await request.json()) as {
    itemId?: string;
    organizationId?: string;
    warehouseId?: string;
    quantity?: number;
    stockValue?: number;
    transactionAt?: string;
    totalCost?: number;
    totalValue?: number;
    type?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    unitCost?: number;
    unit_cost?: number;
    total_cost?: number;
    total_value?: number;
    stock_value?: number;
    value?: number;
    reason?: string;
  };

  const { itemId, warehouseId, quantity, transactionAt, type, reason } = body;

  if (!itemId || !warehouseId || quantity === undefined || !type || !reason || !transactionAt) {
    return badRequest('itemId, warehouseId, quantity, type, reason, and transactionAt are required.');
  }

  if (type !== 'ADJUSTMENT_IN' && type !== 'ADJUSTMENT_OUT') {
    return badRequest('type must be ADJUSTMENT_IN or ADJUSTMENT_OUT.');
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return badRequest('quantity must be a positive number.');
  }

  let resolvedUnitCost = 0;
  let resolvedTotalValue = 0;

  try {
    stage = 'PARSE_TRANSACTION_DATE';
    const parsedTransactionAt = new Date(transactionAt);
    if (Number.isNaN(parsedTransactionAt.getTime())) {
      return badRequest('transactionAt must be a valid ISO date-time.');
    }

    stage = 'LOAD_ITEM_AND_WAREHOUSE';
    const [item, warehouse] = await Promise.all([
      requireItem(service, itemId),
      requireWarehouseAccess(service, warehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
    ]);
    resolvedUnitCost = resolveInventoryUnitCost(body, toNumber(item.unit_cost));
    resolvedTotalValue = Math.max(0, resolveInventoryValue(body, qty * resolvedUnitCost));

    stage = 'LOAD_BALANCE';
    const { data: balance, error: balanceError } = await service
      .from('stock_balances')
      .select('id, quantity_on_hand, quantity_available, quantity_reserved')
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .maybeSingle();
    if (balanceError) {
      return inventoryAdjustmentFailedResponse({
        dbMessage: balanceError.message,
        itemId,
        quantity: qty,
        stage,
        totalValue: resolvedTotalValue,
        unitCost: resolvedUnitCost,
        warehouseId,
      });
    }

    const currentOnHand = Number(balance?.quantity_on_hand ?? 0);
    const currentReserved = Number(balance?.quantity_reserved ?? 0);
    const currentAvailable = Number(balance?.quantity_available ?? (currentOnHand - currentReserved));

    if (type === 'ADJUSTMENT_OUT' && currentAvailable < qty) {
      return badRequest(
        `Insufficient stock for ${item.name}. Available: ${currentAvailable.toFixed(3)}, Required: ${qty.toFixed(3)}`,
      );
    }

    stage = 'CREATE_ADJUSTMENT_RECORD';
    const adjustment = await createInventoryAdjustmentRecord(service, {
      adjustmentDate: parsedTransactionAt.toISOString(),
      createdBy: ctx.userId,
      itemId,
      movementType: type,
      organizationId: ctx.organizationId ?? body.organizationId,
      quantity: qty,
      reason,
      unitCost: resolvedUnitCost,
      warehouseId,
    });

    stage = 'UPDATE_STOCK_BALANCE';
    await applyInventoryDelta(service, {
      itemId,
      organizationId: ctx.organizationId ?? body.organizationId ?? String(item.organization_id ?? warehouse.organization_id ?? ''),
      quantityDelta: type === 'ADJUSTMENT_IN' ? qty : -qty,
      totalValue: resolvedTotalValue,
      unitCost: resolvedUnitCost,
      warehouseId,
    });

    stage = 'STOCK_MOVEMENT_INSERT_FAILED';
    await recordStockMovement(service, {
      createdAt: parsedTransactionAt.toISOString(),
      createdBy: ctx.userId,
      itemId,
      movementType: type,
      notes: reason,
      organizationId: ctx.organizationId ?? body.organizationId ?? String(item.organization_id ?? warehouse.organization_id ?? ''),
      quantity: qty,
      referenceId: String(adjustment.id),
      referenceType: 'stock_adjustment',
      stockValue: body.stockValue ?? body.stock_value,
      totalCost: body.totalCost ?? body.total_cost,
      totalValue: body.totalValue ?? body.total_value,
      unitCost: resolvedUnitCost,
      value: body.value,
      warehouseId,
    });

    stage = 'WRITE_AUDIT_LOG';
    await writeInventoryAuditLog(service, {
      action: 'STOCK_ADJUSTMENT_POSTED',
      details: {
        itemCode: item.code,
        itemName: item.name,
        quantity: qty,
        reason,
        totalValue: resolvedTotalValue,
        transactionAt: parsedTransactionAt.toISOString(),
        type,
        unitCost: resolvedUnitCost,
        warehouseCode: warehouse.code ?? null,
        warehouseName: warehouse.name,
      },
      entityId: String(adjustment.id),
      entityType: 'stock_adjustment',
      userProfileId: ctx.userId,
    });

    stage = 'FETCH_UPDATED_BALANCE';
    const { data: updatedBalance, error: fetchErr } = await service
      .from('stock_balances')
      .select(
        `id, quantity_on_hand, quantity_available, quantity_reserved, last_updated,
         items!item_id(id, code, name, item_type, reorder_level,
           units_of_measure!unit_of_measure_id(id, name, abbreviation)),
         warehouses!warehouse_id(id, code, name,
           branches!branch_id(id, name))`,
      )
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .single();
    if (fetchErr) {
      const fallbackBalanceResult = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available, quantity_reserved, total_value, average_cost, avg_cost, last_updated, updated_at')
        .eq('item_id', itemId)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();

      if (!fallbackBalanceResult.error && fallbackBalanceResult.data) {
        return NextResponse.json(
          {
            ...fallbackBalanceResult.data,
            adjustmentPosted: true,
            warning: 'Stock adjustment posted but updated balance could not be fully reloaded',
          },
          { status: 201 },
        );
      }

      return inventoryAdjustmentSuccessWarningResponse({
        adjustmentId: String(adjustment.id),
        itemId,
        quantity: qty,
        totalValue: resolvedTotalValue,
        unitCost: resolvedUnitCost,
        warehouseId,
        warning: 'Stock adjustment posted but updated balance could not be reloaded',
      });
    }

    return NextResponse.json(updatedBalance, { status: 201 });
  } catch (error) {
    const dbMessage = error instanceof Error ? error.message : 'Failed to post stock adjustment.';
    return inventoryAdjustmentFailedResponse({
      dbMessage,
      itemId,
      quantity: qty,
      stage,
      totalValue: resolvedTotalValue,
      unitCost: resolvedUnitCost,
      warehouseId,
    });
  }
}
