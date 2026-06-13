import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  applyInventoryDelta,
  generateDocumentNumber,
  quantityOrThrow,
  recordStockMovement,
  requireWarehouseAccess,
} from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    deliveryNoteNumber?: string | null;
    items?: Array<{
      batchNumber?: string | null;
      expiryDate?: string | null;
      itemId: string;
      poItemId: string;
      quantityReceived: number;
      quantityRejected?: number;
      unitCost?: number;
    }>;
    notes?: string | null;
    purchaseOrderId?: string;
    warehouseId?: string;
  };

  if (!body.purchaseOrderId || !body.warehouseId || !body.items?.length) {
    return badRequest('purchaseOrderId, warehouseId, and items are required.');
  }

  try {
    await requireWarehouseAccess(service, body.warehouseId, ctx.branchId, ctx.isBranchScoped);

    const grnNumber = await generateDocumentNumber(service, 'goods_received_notes', 'GRN');
    const { data: grn, error: grnError } = await service
      .from('goods_received_notes')
      .insert({
        grn_number: grnNumber,
        purchase_order_id: body.purchaseOrderId,
        warehouse_id: body.warehouseId,
        organization_id: ctx.organizationId,
        received_by: ctx.userId,
        received_date: new Date().toISOString(),
        notes: body.notes ?? body.deliveryNoteNumber ?? null,
        quality_status: 'PENDING',
        status: 'POSTED',
      })
      .select()
      .single();

    if (grnError || !grn) {
      return serverError(grnError?.message ?? 'Failed to create goods received note.');
    }

    const shortages: Array<{ itemId: string; shortageQuantity: number }> = [];

    for (const line of body.items) {
      const quantityReceived = quantityOrThrow(line.quantityReceived, 'quantityReceived');
      const quantityRejected = Number(line.quantityRejected ?? 0);
      const acceptedQuantity = quantityReceived - quantityRejected;

      if (acceptedQuantity < 0) {
        return badRequest('quantityRejected cannot exceed quantityReceived.');
      }

      const { data: poItem, error: poItemError } = await service
        .from('purchase_order_items')
        .select('id, quantity_ordered, quantity_received')
        .eq('id', line.poItemId)
        .single();

      if (poItemError || !poItem) {
        return badRequest('Purchase order item not found.');
      }

      await service.from('goods_received_note_items').insert({
        batch_number: line.batchNumber ?? null,
        expiry_date: line.expiryDate ?? null,
        grn_id: grn.id,
        item_id: line.itemId,
        po_item_id: line.poItemId,
        quantity_expected: Number(poItem.quantity_ordered),
        quantity_received: quantityReceived,
        quantity_rejected: quantityRejected,
        unit_cost: line.unitCost ?? 0,
      });

      await service
        .from('purchase_order_items')
        .update({
          quantity_received: Number(poItem.quantity_received ?? 0) + acceptedQuantity,
        })
        .eq('id', line.poItemId);

      if (acceptedQuantity > 0) {
        await applyInventoryDelta(service, {
          itemId: line.itemId,
          quantityDelta: acceptedQuantity,
          warehouseId: body.warehouseId,
        });
        await recordStockMovement(service, {
          createdBy: ctx.userId,
          itemId: line.itemId,
          movementType: 'PURCHASE_RECEIPT',
          notes: body.notes ?? body.deliveryNoteNumber ?? null,
          quantity: acceptedQuantity,
          referenceId: grn.id,
          referenceType: 'goods_received_note',
          warehouseId: body.warehouseId,
        });
      }

      const shortageQuantity = Math.max(0, Number(poItem.quantity_ordered) - (Number(poItem.quantity_received ?? 0) + acceptedQuantity));
      if (shortageQuantity > 0) {
        shortages.push({ itemId: line.itemId, shortageQuantity });
      }
    }

    return NextResponse.json({
      grnId: grn.id,
      grnNumber,
      itemsCount: body.items.length,
      shortages,
      status: grn.status,
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to receive goods');
  }
}
