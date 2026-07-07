import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import {
  applyInventoryDelta,
  createInventoryAdjustmentRecord,
  recordStockMovement,
  requireItem,
  requireWarehouseAccess,
  writeInventoryAuditLog,
} from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    itemId?: string;
    warehouseId?: string;
    quantity?: number;
    transactionAt?: string;
    type?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
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

  try {
    const parsedTransactionAt = new Date(transactionAt);
    if (Number.isNaN(parsedTransactionAt.getTime())) {
      return badRequest('transactionAt must be a valid ISO date-time.');
    }

    const [item, warehouse] = await Promise.all([
      requireItem(service, itemId),
      requireWarehouseAccess(service, warehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
    ]);

    const { data: balance, error: balanceError } = await service
      .from('stock_balances')
      .select('id, quantity_on_hand, quantity_available, quantity_reserved')
      .eq('item_id', itemId)
      .eq('warehouse_id', warehouseId)
      .maybeSingle();
    if (balanceError) return serverError(balanceError.message);

    const currentOnHand = Number(balance?.quantity_on_hand ?? 0);
    const currentReserved = Number(balance?.quantity_reserved ?? 0);
    const currentAvailable = Number(balance?.quantity_available ?? (currentOnHand - currentReserved));

    if (type === 'ADJUSTMENT_OUT' && currentAvailable < qty) {
      return badRequest(
        `Insufficient stock for ${item.name}. Available: ${currentAvailable.toFixed(3)}, Required: ${qty.toFixed(3)}`,
      );
    }

    const adjustment = await createInventoryAdjustmentRecord(service, {
      adjustmentDate: parsedTransactionAt.toISOString(),
      createdBy: ctx.userId,
      itemId,
      movementType: type,
      organizationId: ctx.organizationId,
      quantity: qty,
      reason,
      warehouseId,
    });

    await applyInventoryDelta(service, {
      itemId,
      organizationId: ctx.organizationId,
      quantityDelta: type === 'ADJUSTMENT_IN' ? qty : -qty,
      warehouseId,
    });

    await recordStockMovement(service, {
      createdAt: parsedTransactionAt.toISOString(),
      createdBy: ctx.userId,
      itemId,
      movementType: type,
      notes: reason,
      organizationId: ctx.organizationId,
      quantity: qty,
      referenceId: String(adjustment.id),
      referenceType: 'stock_adjustment',
      warehouseId,
    });

    await writeInventoryAuditLog(service, {
      action: 'STOCK_ADJUSTMENT_POSTED',
      details: {
        itemCode: item.code,
        itemName: item.name,
        quantity: qty,
        reason,
        transactionAt: parsedTransactionAt.toISOString(),
        type,
        warehouseCode: warehouse.code ?? null,
        warehouseName: warehouse.name,
      },
      entityId: String(adjustment.id),
      entityType: 'stock_adjustment',
      userProfileId: ctx.userId,
    });

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
    if (fetchErr) return serverError(fetchErr.message);

    return NextResponse.json(updatedBalance, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post stock adjustment.');
  }
}
