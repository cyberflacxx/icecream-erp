import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let body: {
    notes?: string | null;
    items: Array<{
      itemId: string;
      poItemId: string;
      quantityReceived: number;
      quantityRejected: number;
      batchNumber?: string | null;
      expiryDate?: string | null;
      qualityNotes?: string | null;
      overReceiveReason?: string | null;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.items?.length) {
    return badRequest('items are required');
  }

  try {
    // Fetch GRN with purchase order items
    const { data: grn, error: grnErr } = await service
      .from('goods_received_notes')
      .select(
        `id, status, warehouse_id, purchase_order_id, grn_number,
         purchase_orders(id, purchase_order_items(*), suppliers(id))`,
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (grnErr || !grn) return notFound('Goods received note not found.');

    const g = grn as Record<string, unknown>;

    // Branch scope check via warehouse
    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: wh } = await service
        .from('warehouses')
        .select('branch_id')
        .eq('id', g.warehouse_id as string)
        .single();
      if (!wh || (wh as Record<string, unknown>).branch_id !== ctx.branchId) {
        return forbidden();
      }
    }

    if (g.status !== 'draft') {
      return badRequest('Only draft GRNs can be received.');
    }

    const po = g.purchase_orders as Record<string, unknown>;
    const poItemsArr = (po.purchase_order_items as Record<string, unknown>[]) ?? [];
    const poItemsById = new Map(poItemsArr.map((i) => [i.id as string, i]));

    const warnings: string[] = [];

    for (const line of body.items) {
      const poItem = poItemsById.get(line.poItemId);

      if (!poItem || poItem.item_id !== line.itemId) {
        return badRequest('GRN line references an invalid purchase order item.');
      }

      if (line.quantityRejected > line.quantityReceived) {
        return badRequest('Rejected quantity cannot exceed received quantity.');
      }

      const quantityOrdered = Number(poItem.quantity_ordered ?? 0);
      const quantityAlreadyReceived = Number(poItem.quantity_received ?? 0);
      const remaining = quantityOrdered - quantityAlreadyReceived;
      const accepted = line.quantityReceived - line.quantityRejected;

      if (accepted < 0) {
        return badRequest('Accepted quantity cannot be negative.');
      }

      if (line.quantityReceived > remaining && !line.overReceiveReason) {
        return badRequest(
          `Received quantity exceeds ordered quantity for PO item ${poItem.id}. Provide overReceiveReason to continue.`,
        );
      }

      if (line.quantityReceived > remaining && line.overReceiveReason) {
        warnings.push(
          `Over-received ${line.quantityReceived} on PO item ${poItem.id}. Reason: ${line.overReceiveReason}`,
        );
      }

      // Upsert GRN item
      const { data: existingGrnItem } = await service
        .from('goods_received_note_items')
        .select('id')
        .eq('grn_id', id)
        .eq('po_item_id', line.poItemId)
        .maybeSingle();

      const grnItemData = {
        grn_id: id,
        item_id: line.itemId,
        po_item_id: line.poItemId,
        quantity_expected: quantityOrdered,
        quantity_received: line.quantityReceived,
        quantity_rejected: line.quantityRejected,
        unit_cost: Number(poItem.unit_cost ?? 0),
        batch_number: line.batchNumber ?? null,
        expiry_date: line.expiryDate ?? null,
        quality_notes: line.qualityNotes ?? null,
      };

      if (existingGrnItem) {
        await service
          .from('goods_received_note_items')
          .update(grnItemData)
          .eq('id', (existingGrnItem as Record<string, unknown>).id);
      } else {
        await service.from('goods_received_note_items').insert(grnItemData);
      }

      // Update PO item received quantity
      await service
        .from('purchase_order_items')
        .update({ quantity_received: quantityAlreadyReceived + accepted })
        .eq('id', line.poItemId);
    }

    // Recalculate PO status
    const { data: refreshedPoItems } = await service
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', po.id as string);

    const allReceived = (refreshedPoItems ?? []).every(
      (i: Record<string, unknown>) => Number(i.quantity_received) >= Number(i.quantity_ordered),
    );
    const anyReceived = (refreshedPoItems ?? []).some(
      (i: Record<string, unknown>) => Number(i.quantity_received) > 0,
    );

    const nextPoStatus = allReceived
      ? 'fully_received'
      : anyReceived
        ? 'partial_received'
        : 'sent_to_supplier';

    await service
      .from('purchase_orders')
      .update({ status: nextPoStatus })
      .eq('id', po.id as string);

    // Update GRN status to received
    const { data: updated, error: updateErr } = await service
      .from('goods_received_notes')
      .update({
        status: 'received',
        notes: body.notes ?? (g.notes as string | null),
        received_by: ctx.userId,
        received_date: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, goods_received_note_items(*), purchase_orders(id, po_number)')
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json({ ...updated, warnings });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
