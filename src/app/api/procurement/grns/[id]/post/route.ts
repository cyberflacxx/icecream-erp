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
import { applyInventoryDelta, recordStockMovement } from '@/lib/inventory-server';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.post', 'procurement.grn.post', 'inventory.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const grn = await loadGrnForPosting(service, ctx.organizationId, id);
    if (!grn) return notFound('Goods received note not found.');
    if (grn.status === 'POSTED' || grn.stock_posted === true) {
      return badRequest('This GRN has already been posted.');
    }
    if (grn.status === 'REJECTED' || grn.quality_status !== 'APPROVED') {
      return badRequest('Only approved GRNs can be posted.');
    }

    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: warehouse, error: warehouseError } = await service
        .from('warehouses')
        .select('branch_id')
        .eq('id', grn.warehouse_id)
        .maybeSingle();
      if (warehouseError) return serverError(warehouseError.message);

      const warehouseBranchId = warehouse?.branch_id ? String(warehouse.branch_id) : null;
      const hasWarehouseAssignment = ctx.warehouseAssignments.includes(String(grn.warehouse_id ?? ''));
      if (warehouseBranchId && warehouseBranchId !== ctx.branchId && !hasWarehouseAssignment) {
        return forbidden();
      }
    }

    const { data: existingMovements, error: movementError } = await service
      .from('stock_movements')
      .select('id')
      .eq('reference_type', 'goods_received_note')
      .eq('reference_id', id)
      .limit(1);

    if (movementError) return serverError(movementError.message);
    if ((existingMovements ?? []).length > 0) {
      return badRequest('Inventory movements already exist for this GRN.');
    }

    const grnItems = await loadPostingItems(service, id);

    if (typeof grnItems === 'string') {
      return serverError(grnItems);
    }

    const postingItems = grnItems as Array<{
      batch_number?: string | null;
      expiry_date?: string | null;
      id: string;
      item_id: string;
      po_item_id?: string | null;
      quantity_expected?: number | null;
      quantity_received?: number | null;
      quantity_rejected?: number | null;
      unit_cost?: number | null;
    }>;

    if (postingItems.length === 0) return badRequest('GRN has no items to post.');

    for (const item of postingItems) {
      const acceptedQuantity = Math.max(
        0,
        Number(item.quantity_received ?? 0) - Number(item.quantity_rejected ?? 0),
      );

      if (item.po_item_id) {
        const { data: poItem, error: poItemError } = await service
          .from('purchase_order_items')
          .select('id, quantity_ordered, quantity_received')
          .eq('id', item.po_item_id)
          .maybeSingle();

        if (poItemError) return serverError(poItemError.message);
        if (poItem) {
          await service
            .from('purchase_order_items')
            .update({
              quantity_received: Number(poItem.quantity_received ?? 0) + acceptedQuantity,
            })
            .eq('id', item.po_item_id);
        }
      }

      if (acceptedQuantity <= 0) {
        continue;
      }

      await applyInventoryDelta(service, {
        itemId: item.item_id,
        organizationId: ctx.organizationId,
        quantityDelta: acceptedQuantity,
        unitCost: Number(item.unit_cost ?? 0),
        warehouseId: String(grn.warehouse_id),
      });

      await recordStockMovement(service, {
        batchNumber: item.batch_number ?? null,
        createdBy: ctx.userId,
        itemId: item.item_id,
        movementType: 'GRN_RECEIPT',
        notes: String(grn.notes ?? ''),
        organizationId: ctx.organizationId,
        quantity: acceptedQuantity,
        referenceId: id,
        referenceType: 'goods_received_note',
        unitCost: Number(item.unit_cost ?? 0),
        warehouseId: String(grn.warehouse_id),
      });
    }

    const purchaseOrderId = resolvePurchaseOrderId(grn as Record<string, unknown>);
    if (purchaseOrderId) {
      const refreshedPoItems = await loadPurchaseOrderItemsForPosting(service, purchaseOrderId);
      if (typeof refreshedPoItems === 'string') return serverError(refreshedPoItems);

      const allReceived = refreshedPoItems.every(
        (item) => Number(item.quantity_received ?? 0) >= Number(item.quantity_ordered ?? 0),
      );
      const anyReceived = refreshedPoItems.some(
        (item) => Number(item.quantity_received ?? 0) > 0,
      );

      await service
        .from('purchase_orders')
        .update({
          status: allReceived ? 'fully_received' : anyReceived ? 'partial_received' : 'sent_to_supplier',
        })
        .eq('id', purchaseOrderId);
    }

    const { data: updated, error: updateError } = await service
      .from('goods_received_notes')
      .update({
        approval_notes: grn.approval_notes ?? null,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        stock_posted: true,
        status: 'POSTED',
        quality_status: 'POSTED',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return serverError(updateError.message);

    await recordAuditLog({
      action: 'GRN_POSTED',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: {
        status: 'POSTED',
        warehouseId: grn.warehouse_id,
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post GRN.');
  }
}

function isMissingColumnError(error: { message?: string } | null | undefined, table: string, columnName: string) {
  return (error?.message ?? '').includes(`column ${table}.${columnName} does not exist`);
}

async function loadGrnForPosting(
  service: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  grnId: string,
) {
  const primary = await service
    .from('goods_received_notes')
    .select('id, grn_number, status, quality_status, warehouse_id, purchase_order_id, notes, stock_posted, approval_notes')
    .eq('organization_id', organizationId)
    .eq('id', grnId)
    .maybeSingle();
  if (!primary.error) {
    return primary.data;
  }

  const compatibleLegacy = isMissingColumnError(primary.error, 'goods_received_notes', 'purchase_order_id');
  if (!compatibleLegacy) {
    throw new Error(primary.error.message);
  }

  const fallback = await service
    .from('goods_received_notes')
    .select('id, grn_number, status, quality_status, warehouse_id, po_id, notes, approval_notes')
    .eq('organization_id', organizationId)
    .eq('id', grnId)
    .maybeSingle();
  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return fallback.data;
}

function resolvePurchaseOrderId(grn: Record<string, unknown>) {
  const purchaseOrderId = grn.purchase_order_id ?? grn.po_id;
  return purchaseOrderId ? String(purchaseOrderId) : null;
}

async function loadPostingItems(
  service: ReturnType<typeof createServiceRoleClient>,
  grnId: string,
) {
  const primary = await service
    .from('goods_received_note_items')
    .select('id, item_id, po_item_id, quantity_expected, quantity_received, quantity_rejected, unit_cost, batch_number, expiry_date')
    .eq('grn_id', grnId);
  if (!primary.error) {
    return primary.data ?? [];
  }

  if (!primary.error.message.includes('goods_received_note_items')) {
    return primary.error.message;
  }

  const fallback = await service
    .from('grn_items')
    .select('id, item_id, po_item_id, ordered_qty, received_qty, rejected_qty, unit_cost, batch_number, expiry_date')
    .eq('grn_id', grnId);
  if (fallback.error) {
    return fallback.error.message;
  }

  return (fallback.data ?? []).map((item) => ({
    ...item,
    quantity_expected: item.ordered_qty,
    quantity_received: item.received_qty,
    quantity_rejected: item.rejected_qty,
  }));
}

async function loadPurchaseOrderItemsForPosting(
  service: ReturnType<typeof createServiceRoleClient>,
  purchaseOrderId: string,
) {
  const primary = await service
    .from('purchase_order_items')
    .select('quantity_ordered, quantity_received')
    .eq('purchase_order_id', purchaseOrderId);
  if (!primary.error) {
    return primary.data ?? [];
  }

  if (!isMissingColumnError(primary.error, 'purchase_order_items', 'purchase_order_id')) {
    return primary.error.message;
  }

  const fallback = await service
    .from('purchase_order_items')
    .select('quantity_ordered, received_qty')
    .eq('po_id', purchaseOrderId);
  if (fallback.error) {
    return fallback.error.message;
  }

  return (fallback.data ?? []).map((item) => ({
    ...item,
    quantity_received: item.received_qty,
  }));
}
