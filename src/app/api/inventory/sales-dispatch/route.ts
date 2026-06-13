import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  applyInventoryDelta,
  generateDocumentNumber,
  quantityOrThrow,
  recordStockMovement,
  requireWarehouseAccess,
  verifyApprovedInvoice,
} from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'sales.write')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    invoiceId?: string;
    items?: Array<{ itemId: string; quantity: number }>;
    notes?: string | null;
    vehicleOrDeliveryNote?: string | null;
    warehouseId?: string;
  };

  if (!body.invoiceId || !body.warehouseId) {
    return badRequest('invoiceId and warehouseId are required.');
  }

  try {
    const invoice = await verifyApprovedInvoice(service, body.invoiceId);
    await requireWarehouseAccess(service, body.warehouseId, ctx.branchId, ctx.isBranchScoped);

    const invoiceLines = body.items?.length
      ? body.items
      : await loadInvoiceItems(service, body.invoiceId);

    if (!invoiceLines.length) {
      return badRequest('The approved invoice has no dispatchable items.');
    }

    const deliveryNumber = await generateDocumentNumber(service, 'delivery_notes', 'DSP');
    const { data: delivery, error: deliveryError } = await service
      .from('delivery_notes')
      .insert({
        delivery_number: deliveryNumber,
        sales_order_id: invoice.sales_order_id ?? null,
        delivery_date: new Date().toISOString().slice(0, 10),
        notes: body.notes ?? body.vehicleOrDeliveryNote ?? null,
        status: 'DISPATCHED',
        delivered_by: ctx.userId,
      })
      .select()
      .single();

    if (deliveryError || !delivery) {
      return serverError(deliveryError?.message ?? 'Failed to create dispatch record.');
    }

    for (const line of invoiceLines) {
      const quantity = quantityOrThrow(line.quantity);
      await applyInventoryDelta(service, {
        itemId: line.itemId,
        quantityDelta: -quantity,
        warehouseId: body.warehouseId,
      });
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: line.itemId,
        movementType: 'SALES_DISPATCH',
        notes: body.notes ?? body.vehicleOrDeliveryNote ?? null,
        quantity,
        referenceId: delivery.id,
        referenceType: 'sales_dispatch',
        warehouseId: body.warehouseId,
      });
    }

    return NextResponse.json({
      dispatchNumber: deliveryNumber,
      invoiceId: body.invoiceId,
      invoiceNumber: invoice.invoice_number,
      itemsCount: invoiceLines.length,
      status: 'DISPATCHED',
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to dispatch stock');
  }
}

async function loadInvoiceItems(service: ReturnType<typeof createServiceRoleClient>, invoiceId: string) {
  const { data, error } = await service
    .from('invoice_items')
    .select('item_id, quantity')
    .eq('invoice_id', invoiceId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    itemId: String(row.item_id),
    quantity: Number(row.quantity),
  }));
}
