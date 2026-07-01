import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { applyInventoryDelta, getBalance, recordStockMovement, requireItem } from '@/lib/inventory-server';
import { normalizeTransferStatus } from '@/lib/inventory';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.complete', 'inventory.write', 'stock_transfer.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: transfer, error: transferError } = await service
      .from('stock_transfers')
      .select('id, transfer_number, status, notes, from_warehouse_id, to_warehouse_id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (transferError) return serverError(transferError.message);
    if (!transfer) return notFound('Stock transfer not found.');
    if (normalizeTransferStatus(String(transfer.status ?? '')) === 'COMPLETED') {
      return badRequest('This transfer has already been completed.');
    }
    if (String(transfer.status ?? '').toUpperCase() === 'CANCELLED') {
      return badRequest('Cancelled transfers cannot be completed.');
    }

    const { data: existingMovements, error: existingMovementsError } = await service
      .from('stock_movements')
      .select('id')
      .eq('reference_type', 'stock_transfer')
      .eq('reference_id', id)
      .limit(1);
    if (existingMovementsError) return serverError(existingMovementsError.message);
    if ((existingMovements ?? []).length > 0) {
      return badRequest('Inventory movements already exist for this transfer.');
    }

    const { data: transferItems, error: transferItemsError } = await service
      .from('stock_transfer_items')
      .select('id, item_id, quantity_requested')
      .eq('transfer_id', id);
    if (transferItemsError) return serverError(transferItemsError.message);
    if ((transferItems ?? []).length === 0) return badRequest('Transfer has no items.');

    for (const row of transferItems ?? []) {
      const item = await requireItem(service, String(row.item_id));
      const quantity = Number(row.quantity_requested ?? 0);
      const sourceBalance = await getBalance(service, item.id, String(transfer.from_warehouse_id));
      const sourceAvailable = Number(sourceBalance?.quantity_available ?? 0);

      if (quantity <= 0) {
        return badRequest(`Transfer line for ${item.name} must be greater than zero.`);
      }

      if (sourceAvailable < quantity) {
        return badRequest(`Insufficient stock for ${item.name}. Available: ${sourceAvailable.toFixed(3)}, Required: ${quantity.toFixed(3)}`);
      }
    }

    for (const row of transferItems ?? []) {
      const quantity = Number(row.quantity_requested ?? 0);
      const itemId = String(row.item_id);

      await applyInventoryDelta(service, {
        itemId,
        organizationId: ctx.organizationId,
        quantityDelta: -quantity,
        warehouseId: String(transfer.from_warehouse_id),
      });
      await applyInventoryDelta(service, {
        itemId,
        organizationId: ctx.organizationId,
        quantityDelta: quantity,
        warehouseId: String(transfer.to_warehouse_id),
      });

      await recordStockMovement(service, {
        createdBy: ctx.userId,
        destinationWarehouseId: String(transfer.to_warehouse_id),
        itemId,
        movementType: 'TRANSFER_OUT',
        notes: String(transfer.notes ?? ''),
        organizationId: ctx.organizationId,
        quantity,
        referenceId: id,
        referenceType: 'stock_transfer',
        sourceWarehouseId: String(transfer.from_warehouse_id),
        warehouseId: String(transfer.from_warehouse_id),
      });
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        destinationWarehouseId: String(transfer.to_warehouse_id),
        itemId,
        movementType: 'TRANSFER_IN',
        notes: String(transfer.notes ?? ''),
        organizationId: ctx.organizationId,
        quantity,
        referenceId: id,
        referenceType: 'stock_transfer',
        sourceWarehouseId: String(transfer.from_warehouse_id),
        warehouseId: String(transfer.to_warehouse_id),
      });

      await service
        .from('stock_transfer_items')
        .update({
          quantity_received: quantity,
          quantity_sent: quantity,
        })
        .eq('id', row.id);
    }

    const { data: updated, error: updateError } = await service
      .from('stock_transfers')
      .update({ status: 'COMPLETED', approved_by: ctx.userId })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return serverError(updateError.message);

    await recordAuditLog({
      action: 'INVENTORY_TRANSFER_COMPLETED',
      entityId: id,
      entityType: 'stock_transfer',
      newValues: { status: 'COMPLETED', transferNumber: transfer.transfer_number },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to complete stock transfer.');
  }
}
