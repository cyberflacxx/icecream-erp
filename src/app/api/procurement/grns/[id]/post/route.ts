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

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return error instanceof Error && error.message.includes(`column ${table}.${columnName} does not exist`);
}

function isApprovedGrn(grn: { status?: unknown; quality_status?: unknown }) {
  const status = String(grn.status ?? '').toUpperCase();
  const qualityStatus = String(grn.quality_status ?? '').toUpperCase();
  return status === 'APPROVED' || (status === 'RECEIVED' && qualityStatus === 'APPROVED');
}

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
    const { data: grn, error: grnError } = await service
      .from('goods_received_notes')
      .select('id, grn_number, status, quality_status, warehouse_id, purchase_order_id, po_id, notes')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (grnError) return serverError(grnError.message);
    if (!grn) return notFound('Goods received note not found.');
    if (grn.status === 'POSTED') return badRequest('This GRN has already been posted.');
    if (!isApprovedGrn(grn)) return badRequest('Only approved GRNs can be posted.');

    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: warehouse, error: warehouseError } = await service
        .from('warehouses')
        .select('branch_id')
        .eq('id', grn.warehouse_id)
        .maybeSingle();
      if (warehouseError) return serverError(warehouseError.message);
      if (!warehouse || (warehouse.branch_id && warehouse.branch_id !== ctx.branchId)) return forbidden();
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

    const itemsPrimary = await service
      .from('goods_received_note_items')
      .select('id, item_id, po_item_id, quantity_expected, quantity_received, quantity_rejected, unit_cost, batch_number, expiry_date')
      .eq('grn_id', id);

    let grnItemsResult = itemsPrimary;
    if (itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'goods_received_note_items', 'grn_id')) {
      grnItemsResult = await service
        .from('goods_received_note_items')
        .select('id, item_id, po_item_id, quantity_expected, quantity_received, quantity_rejected, unit_cost, batch_number, expiry_date')
        .eq('goods_received_note_id', id);
    }

    if (grnItemsResult.error) return serverError(grnItemsResult.error.message);

    const grnItems = (grnItemsResult.data ?? []) as Array<{
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

    if (grnItems.length === 0) return badRequest('GRN has no items to post.');

    for (const item of grnItems) {
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
        warehouseId: String(grn.warehouse_id),
      });

      await recordStockMovement(service, {
        batchNumber: item.batch_number ?? null,
        createdBy: ctx.userId,
        itemId: item.item_id,
        movementType: 'PURCHASE_RECEIVE',
        notes: String(grn.notes ?? ''),
        organizationId: ctx.organizationId,
        quantity: acceptedQuantity,
        referenceId: id,
        referenceType: 'goods_received_note',
        warehouseId: String(grn.warehouse_id),
      });
    }

    const purchaseOrderId = String(grn.purchase_order_id ?? grn.po_id ?? '');
    if (purchaseOrderId) {
      const primaryPoItems = await service
        .from('purchase_order_items')
        .select('quantity_ordered, quantity_received')
        .eq('purchase_order_id', purchaseOrderId);
      const refreshedPoItemsResult =
        primaryPoItems.error && isMissingColumnError(primaryPoItems.error, 'purchase_order_items', 'purchase_order_id')
          ? await service
              .from('purchase_order_items')
              .select('quantity_ordered, quantity_received')
              .eq('po_id', purchaseOrderId)
          : primaryPoItems;
      if (refreshedPoItemsResult.error) return serverError(refreshedPoItemsResult.error.message);

      const allReceived = (refreshedPoItemsResult.data ?? []).every(
        (item) => Number(item.quantity_received ?? 0) >= Number(item.quantity_ordered ?? 0),
      );
      const anyReceived = (refreshedPoItemsResult.data ?? []).some(
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
