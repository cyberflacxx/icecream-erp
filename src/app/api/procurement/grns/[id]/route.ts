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
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.view', 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const primary = await service
    .from('goods_received_notes')
    .select(
      `id, grn_number, received_date, status, quality_status, warehouse_id, purchase_order_id, notes, quality_notes,
       purchase_orders(id, po_number, suppliers(id, name)),
       goods_received_note_items(id, item_id, po_item_id, quantity_expected, quantity_received, quantity_rejected, unit_cost, batch_number, expiry_date, quality_notes, items(id, code, name, unit_of_measure_id))`,
    )
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  const detail =
    primary.error && isMissingColumnError(primary.error, 'goods_received_notes', 'purchase_order_id')
      ? await service
          .from('goods_received_notes')
          .select(
            `id, grn_number, received_date, status, warehouse_id, po_id, notes, invoice_ref,
             purchase_orders:purchase_orders!goods_received_notes_po_id_fkey(id, po_number, suppliers(id, name)),
             grn_items(id, item_id, po_item_id, ordered_qty, received_qty, rejected_qty, unit_cost, batch_number, expiry_date, quality_notes, items(id, code, name, unit_of_measure_id))`,
          )
          .eq('organization_id', ctx.organizationId)
          .eq('id', id)
          .maybeSingle()
      : primary;

  if (detail.error) return serverError(detail.error.message);
  if (!detail.data) return notFound('Goods received note not found.');

  const row = detail.data as Record<string, unknown>;
  const purchaseOrderId = row.purchase_order_id ?? row.po_id;
  const lineItems = (row.goods_received_note_items ?? row.grn_items ?? []) as Array<Record<string, unknown>>;

  return NextResponse.json({
    ...row,
    warehouse_id: row.warehouse_id ? String(row.warehouse_id) : null,
    warehouseId: row.warehouse_id ? String(row.warehouse_id) : null,
    receiving_warehouse_id: row.warehouse_id ? String(row.warehouse_id) : null,
    receivingWarehouseId: row.warehouse_id ? String(row.warehouse_id) : null,
    purchase_order_id: purchaseOrderId ? String(purchaseOrderId) : null,
    purchaseOrderId: purchaseOrderId ? String(purchaseOrderId) : null,
    qualityNotes: row.quality_notes ?? row.invoice_ref ?? null,
    items: lineItems.map((item) => {
      const product = Array.isArray(item.items) ? item.items[0] : item.items;
      const itemId = item.item_id ? String(item.item_id) : null;
      const poItemId = item.po_item_id ? String(item.po_item_id) : null;
      const unitOfMeasureId = product && (product as Record<string, unknown>).unit_of_measure_id
        ? String((product as Record<string, unknown>).unit_of_measure_id)
        : null;

      return {
        ...item,
        item_id: itemId,
        itemId,
        po_item_id: poItemId,
        poItemId,
        quantity_expected: item.quantity_expected ?? item.ordered_qty ?? 0,
        quantity_received: item.quantity_received ?? item.received_qty ?? 0,
        quantity_rejected: item.quantity_rejected ?? item.rejected_qty ?? 0,
        unit_of_measure_id: unitOfMeasureId,
        unitOfMeasureId,
        uomId: unitOfMeasureId,
      };
    }),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.edit', 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    notes?: string | null;
    qualityNotes?: string | null;
    receivedDate?: string | null;
  };

  const { data: existing, error: existingError } = await service
    .from('goods_received_notes')
    .select('id, status')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (existingError) return serverError(existingError.message);
  if (!existing) return notFound('Goods received note not found.');
  if (String(existing.status ?? '').toUpperCase() !== 'DRAFT') {
    return badRequest('Only draft GRNs can be edited.');
  }

  const updates: Record<string, unknown> = {};
  if (body.notes !== undefined) updates.notes = body.notes ?? null;
  if (body.qualityNotes !== undefined) updates.quality_notes = body.qualityNotes ?? null;
  if (body.receivedDate !== undefined) updates.received_date = body.receivedDate ?? null;

  const { data, error } = await service
    .from('goods_received_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
