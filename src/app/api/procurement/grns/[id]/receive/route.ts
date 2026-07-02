import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { calculateAcceptedQuantity, calculateShortageQuantity } from '@/lib/inventory';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const OPTIONAL_GRN_ITEM_COLUMNS = new Set([
  'accepted_quantity',
  'damaged_quantity',
  'remarks',
  'shortage_quantity',
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.submit', 'stores.grn.edit', 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let body: {
    notes?: string | null;
    items: Array<{
      damagedQuantity?: number;
      itemId: string;
      poItemId?: string | null;
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

    if (g.status !== 'DRAFT') {
      return badRequest('Only draft GRNs can be submitted.');
    }

    const po = g.purchase_orders as Record<string, unknown> | null;
    const poItemsArr = ((po?.purchase_order_items as Record<string, unknown>[]) ?? []);
    const poItemsById = new Map(poItemsArr.map((i) => [i.id as string, i]));
    const existingGrnItemsResult = await service
      .from('goods_received_note_items')
      .select('id, item_id, po_item_id, quantity_expected, unit_cost')
      .eq('grn_id', id);
    if (existingGrnItemsResult.error) return serverError(existingGrnItemsResult.error.message);
    const grnItemsByItemId = new Map(
      (existingGrnItemsResult.data ?? []).map((item) => [String(item.item_id), item as Record<string, unknown>]),
    );

    const warnings: string[] = [];

    for (const line of body.items) {
      const poItem = line.poItemId ? poItemsById.get(line.poItemId) : null;
      const manualGrnItem = grnItemsByItemId.get(line.itemId) ?? null;

      if (g.purchase_order_id && (!poItem || poItem.item_id !== line.itemId)) {
        return badRequest('GRN line references an invalid purchase order item.');
      }
      if (!g.purchase_order_id && !manualGrnItem) {
        return badRequest('GRN line references an invalid manual receipt item.');
      }

      const quantityOrdered = g.purchase_order_id
        ? Number(poItem?.quantity_ordered ?? 0)
        : Number(manualGrnItem?.quantity_expected ?? 0);
      const quantityAlreadyReceived = g.purchase_order_id ? Number(poItem?.quantity_received ?? 0) : 0;
      const remaining = g.purchase_order_id ? quantityOrdered - quantityAlreadyReceived : quantityOrdered;
      const accepted = calculateAcceptedQuantity({
        damagedQuantity: line.damagedQuantity ?? 0,
        receivedQuantity: line.quantityReceived,
        rejectedQuantity: line.quantityRejected,
      });
      const shortageQuantity = calculateShortageQuantity({
        orderedQuantity: quantityOrdered,
        receivedQuantity: line.quantityReceived,
      });

      if (g.purchase_order_id && line.quantityReceived > remaining && !line.overReceiveReason) {
        return badRequest(
          `Received quantity exceeds ordered quantity for PO item ${poItem?.id}. Provide overReceiveReason to continue.`,
        );
      }

      if (g.purchase_order_id && line.quantityReceived > remaining && line.overReceiveReason) {
        warnings.push(
          `Over-received ${line.quantityReceived} on PO item ${poItem?.id}. Reason: ${line.overReceiveReason}`,
        );
      }

      // Upsert GRN item
      const existingGrnItem = g.purchase_order_id
        ? await service
            .from('goods_received_note_items')
            .select('id')
            .eq('grn_id', id)
            .eq('po_item_id', line.poItemId ?? '')
            .maybeSingle()
        : { data: manualGrnItem ? { id: manualGrnItem.id } : null, error: null };

      if (existingGrnItem.error) return serverError(existingGrnItem.error.message);

      const grnItemData = {
        grn_id: id,
        item_id: line.itemId,
        po_item_id: line.poItemId ?? null,
        quantity_expected: quantityOrdered,
        quantity_received: line.quantityReceived,
        quantity_rejected: line.quantityRejected,
        accepted_quantity: accepted,
        damaged_quantity: Number(line.damagedQuantity ?? 0),
        shortage_quantity: shortageQuantity,
        unit_cost: Number(poItem?.unit_cost ?? manualGrnItem?.unit_cost ?? 0),
        batch_number: line.batchNumber ?? null,
        expiry_date: line.expiryDate ?? null,
        remarks: line.overReceiveReason ?? null,
        quality_notes:
          line.qualityNotes ??
          `accepted=${accepted}; damaged=${Number(line.damagedQuantity ?? 0)}; shortage=${shortageQuantity}`,
      };

      if (existingGrnItem.data) {
        const updateError = await writeGrnItem(
          service,
          'update',
          grnItemData,
          (query) => query.eq('id', String((existingGrnItem.data as Record<string, unknown>).id)),
        );
        if (updateError) {
          return serverError(updateError);
        }
      } else {
        const insertError = await writeGrnItem(service, 'insert', grnItemData);
        if (insertError) {
          return serverError(insertError);
        }
      }
    }

    // Move to approval queue. Stock is still not posted at this point.
    const { data: updated, error: updateErr } = await service
      .from('goods_received_notes')
      .update({
        status: 'PENDING_APPROVAL',
        notes: body.notes ?? (g.notes as string | null),
        received_by: ctx.userId,
        received_date: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, purchase_orders(id, po_number)')
      .single();

    if (updateErr) return serverError(updateErr.message);

    await recordAuditLog({
      action: 'GRN_SUBMITTED',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: {
        itemCount: body.items.length,
        status: 'PENDING_APPROVAL',
        warnings,
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ ...updated, warnings });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

async function writeGrnItem(
  service: ReturnType<typeof createServiceRoleClient>,
  operation: 'insert' | 'update',
  values: Record<string, unknown>,
  applyFilter?: (query: any) => any,
) {
  const payload: Record<string, unknown> = { ...values };

  for (let attempt = 0; attempt < OPTIONAL_GRN_ITEM_COLUMNS.size + 1; attempt += 1) {
    let query =
      operation === 'insert'
        ? service.from('goods_received_note_items').insert(payload)
        : service.from('goods_received_note_items').update(payload);

    if (applyFilter) {
      query = applyFilter(query);
    }

    const { error } = await query;
    if (!error) {
      return null;
    }

    const missingColumn = extractMissingColumnName(error, 'goods_received_note_items');
    if (!missingColumn || !OPTIONAL_GRN_ITEM_COLUMNS.has(missingColumn)) {
      return error.message;
    }

    delete payload[missingColumn];
  }

  return 'Failed to write GRN item.';
}

function extractMissingColumnName(
  error: { message?: string } | null | undefined,
  table: string,
) {
  const message = error?.message ?? '';
  const match = message.match(new RegExp(`column\\s+${table}\\.([a-z_]+)\\s+does not exist`, 'i'));
  return match?.[1] ?? null;
}
