import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: order, error } = await service
      .from('purchase_orders')
      .select(
        `id, po_number, order_date, expected_delivery_date, status,
         subtotal, tax_amount, discount_amount, total,
         suppliers(id, name),
         purchase_order_items(
           id, quantity_ordered, quantity_received, unit_cost, total_cost,
           items(id, code, name),
           units_of_measure(id, name, abbreviation)
         ),
         goods_received_notes(
           id, grn_number, received_date, status, quality_status,
           goods_received_note_items(id)
         )`,
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (error || !order) return notFound('Purchase order not found.');

    const o = order as Record<string, unknown>;

    return NextResponse.json({
      id: o.id,
      poNumber: o.po_number,
      orderDate: o.order_date,
      expectedDeliveryDate: o.expected_delivery_date,
      status: o.status,
      subtotal: Number(o.subtotal ?? 0),
      taxAmount: Number(o.tax_amount ?? 0),
      discountAmount: Number(o.discount_amount ?? 0),
      total: Number(o.total ?? 0),
      supplier: o.suppliers
        ? { id: (o.suppliers as Record<string, unknown>).id, name: (o.suppliers as Record<string, unknown>).name }
        : null,
      items: ((o.purchase_order_items as Record<string, unknown>[]) ?? []).map((item) => ({
        id: item.id,
        quantityOrdered: Number(item.quantity_ordered ?? 0),
        quantityReceived: Number(item.quantity_received ?? 0),
        unitCost: Number(item.unit_cost ?? 0),
        totalCost: Number(item.total_cost ?? 0),
        item: item.items
          ? {
              id: (item.items as Record<string, unknown>).id,
              code: (item.items as Record<string, unknown>).code,
              name: (item.items as Record<string, unknown>).name,
            }
          : null,
        unitOfMeasure: item.units_of_measure
          ? {
              id: (item.units_of_measure as Record<string, unknown>).id,
              name: (item.units_of_measure as Record<string, unknown>).name,
              abbreviation: (item.units_of_measure as Record<string, unknown>).abbreviation,
            }
          : null,
      })),
      grns: ((o.goods_received_notes as Record<string, unknown>[]) ?? []).map((grn) => ({
        id: grn.id,
        grnNumber: grn.grn_number,
        receivedDate: grn.received_date,
        status: grn.status,
        qualityStatus: grn.quality_status,
        itemsCount: Array.isArray(grn.goods_received_note_items)
          ? (grn.goods_received_note_items as unknown[]).length
          : 0,
      })),
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let body: {
    supplierId?: string;
    orderDate?: string | null;
    expectedDeliveryDate?: string | null;
    notes?: string | null;
    taxAmount?: number;
    discountAmount?: number;
    items?: Array<{
      itemId: string;
      unitOfMeasureId: string;
      quantityOrdered: number;
      unitCost: number;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_orders')
      .select('id, status, subtotal, tax_amount, discount_amount, purchase_order_items(id, item_id, unit_of_measure_id, quantity_ordered, unit_cost)')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase order not found.');

    const order = existing as Record<string, unknown>;
    if (order.status !== 'draft') {
      return badRequest('Only draft purchase orders can be edited.');
    }

    // Validate items if provided
    if (body.items?.length) {
      const itemIds = [...new Set(body.items.map((i) => i.itemId))];
      const unitIds = [...new Set(body.items.map((i) => i.unitOfMeasureId))];
      const [itemsCheck, unitsCheck] = await Promise.all([
        service.from('items').select('id').is('deleted_at', null).eq('organization_id', ctx.organizationId).in('id', itemIds),
        service.from('units_of_measure').select('id').eq('organization_id', ctx.organizationId).in('id', unitIds),
      ]);

      if (
        (itemsCheck.data?.length ?? 0) !== itemIds.length ||
        (unitsCheck.data?.length ?? 0) !== unitIds.length
      ) {
        return badRequest('One or more purchase order items are invalid.');
      }
    }

    // Recalculate totals
    const nextItems = body.items
      ? body.items
      : ((order.purchase_order_items as Record<string, unknown>[]) ?? []).map((i) => ({
          itemId: i.item_id as string,
          unitOfMeasureId: i.unit_of_measure_id as string,
          quantityOrdered: Number(i.quantity_ordered ?? 0),
          unitCost: Number(i.unit_cost ?? 0),
        }));
    const taxAmount = body.taxAmount !== undefined ? body.taxAmount : Number(order.tax_amount ?? 0);
    const discountAmount = body.discountAmount !== undefined ? body.discountAmount : Number(order.discount_amount ?? 0);
    const subtotal = nextItems.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
    const total = subtotal + taxAmount - discountAmount;

    const updatePayload: Record<string, unknown> = { subtotal, total };
    if (body.supplierId !== undefined) updatePayload.supplier_id = body.supplierId;
    if (body.orderDate !== undefined) updatePayload.order_date = body.orderDate;
    if (body.expectedDeliveryDate !== undefined) updatePayload.expected_delivery_date = body.expectedDeliveryDate;
    if (body.notes !== undefined) updatePayload.notes = body.notes;
    if (body.taxAmount !== undefined) updatePayload.tax_amount = body.taxAmount;
    if (body.discountAmount !== undefined) updatePayload.discount_amount = body.discountAmount;

    const { error: updateErr } = await service
      .from('purchase_orders')
      .update(updatePayload)
      .eq('id', id);
    if (updateErr) return serverError(updateErr.message);

    // Replace items if provided
    if (body.items) {
      await service.from('purchase_order_items').delete().eq('purchase_order_id', id);

      const { error: itemsErr } = await service.from('purchase_order_items').insert(
        body.items.map((item) => ({
          purchase_order_id: id,
          item_id: item.itemId,
          unit_of_measure_id: item.unitOfMeasureId,
          quantity_ordered: item.quantityOrdered,
          quantity_received: 0,
          unit_cost: item.unitCost,
          total_cost: item.quantityOrdered * item.unitCost,
        })),
      );
      if (itemsErr) return serverError(itemsErr.message);
    }

    const { data: full } = await service
      .from('purchase_orders')
      .select('*, purchase_order_items(*), suppliers(id, name)')
      .eq('id', id)
      .single();

    return NextResponse.json(full);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
