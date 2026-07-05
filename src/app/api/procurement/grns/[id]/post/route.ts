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
      .select(
        `id, grn_number, status, quality_status, warehouse_id, purchase_order_id, notes,
         goods_received_note_items(id, item_id, po_item_id, quantity_expected, quantity_received, quantity_rejected, unit_cost, batch_number, expiry_date)`,
      )
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

    const grnItems = (grn.goods_received_note_items ?? []) as Array<{
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
        movementType: 'GRN_RECEIPT',
        notes: String(grn.notes ?? ''),
        organizationId: ctx.organizationId,
        quantity: acceptedQuantity,
        referenceId: id,
        referenceType: 'goods_received_note',
        warehouseId: String(grn.warehouse_id),
      });
    }

    if (grn.purchase_order_id) {
      const { data: refreshedPoItems, error: refreshedPoItemsError } = await service
        .from('purchase_order_items')
        .select('quantity_ordered, quantity_received')
        .eq('purchase_order_id', grn.purchase_order_id);
      if (refreshedPoItemsError) return serverError(refreshedPoItemsError.message);

      const allReceived = (refreshedPoItems ?? []).every(
        (item) => Number(item.quantity_received ?? 0) >= Number(item.quantity_ordered ?? 0),
      );
      const anyReceived = (refreshedPoItems ?? []).some(
        (item) => Number(item.quantity_received ?? 0) > 0,
      );

      await service
        .from('purchase_orders')
        .update({
          status: allReceived ? 'fully_received' : anyReceived ? 'partial_received' : 'sent_to_supplier',
        })
        .eq('id', grn.purchase_order_id);
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
