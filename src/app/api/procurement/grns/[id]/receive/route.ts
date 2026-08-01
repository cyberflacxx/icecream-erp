import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isWarehouseAvailableToContext } from '@/lib/branch-access';
import { calculateAcceptedQuantity, calculateShortageQuantity } from '@/lib/inventory';
import { findMatchingGrnReceiveLine } from '@/lib/procurement-goods-received';
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
  if (!can(ctx, 'stores.grn.submit', 'stores.grn.edit', 'procurement.write', 'inventory.write')) return forbidden();

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
    const grn = await loadGrnForReceive(service, ctx.organizationId, id);
    if (!grn) return notFound('Goods received note not found.');

    const g = grn as Record<string, unknown>;
    const purchaseOrderId = resolveGrnPurchaseOrderId(g);

    const { data: warehouse, error: warehouseError } = await service
      .from('warehouses')
      .select('id, organization_id, branch_id, is_active, name')
      .eq('id', String(g.warehouse_id ?? ''))
      .maybeSingle();
    if (warehouseError) return serverError(warehouseError.message);
    if (
      !isWarehouseAvailableToContext(ctx, warehouse
        ? {
            branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
            id: String(warehouse.id),
            isActive: warehouse.is_active !== false,
            name: warehouse.name ? String(warehouse.name) : null,
            organizationId: String(warehouse.organization_id ?? ''),
          }
        : null)
    ) {
      return forbidden();
    }

    if (g.status !== 'DRAFT') {
      return badRequest('Only draft GRNs can be submitted.');
    }

    const poItemsArr = purchaseOrderId
      ? await loadPurchaseOrderItems(service, purchaseOrderId)
      : [];
    const poItemsById = new Map(poItemsArr.map((i) => [i.id as string, i]));
    const existingGrnItemsResult = await loadExistingGrnItems(service, id);
    if (typeof existingGrnItemsResult === 'string') return serverError(existingGrnItemsResult);
    const warnings: string[] = [];

    for (const line of body.items) {
      const poItem = line.poItemId ? poItemsById.get(line.poItemId) : null;
      const matchingGrnItem = findMatchingGrnReceiveLine(existingGrnItemsResult, {
        itemId: line.itemId,
        poItemId: line.poItemId ?? null,
      });
      const manualGrnItem = matchingGrnItem ?? null;

      if (purchaseOrderId && (!poItem || poItem.item_id !== line.itemId)) {
        return badRequest('GRN line references an invalid purchase order item.');
      }
      if (!purchaseOrderId && !manualGrnItem) {
        return badRequest('GRN line references an invalid manual receipt item.');
      }

      const quantityOrdered = purchaseOrderId
        ? Number(poItem?.quantity_ordered ?? 0)
        : Number(manualGrnItem?.quantity_expected ?? 0);
      const quantityAlreadyReceived = purchaseOrderId ? Number(poItem?.quantity_received ?? 0) : 0;
      const remaining = purchaseOrderId ? quantityOrdered - quantityAlreadyReceived : quantityOrdered;
      const accepted = calculateAcceptedQuantity({
        damagedQuantity: line.damagedQuantity ?? 0,
        receivedQuantity: line.quantityReceived,
        rejectedQuantity: line.quantityRejected,
      });
      const shortageQuantity = calculateShortageQuantity({
        orderedQuantity: quantityOrdered,
        receivedQuantity: line.quantityReceived,
      });

      if (purchaseOrderId && line.quantityReceived > remaining && !line.overReceiveReason) {
        return badRequest(
          `Received quantity exceeds ordered quantity for PO item ${poItem?.id}. Provide overReceiveReason to continue.`,
        );
      }

      if (purchaseOrderId && line.quantityReceived > remaining && line.overReceiveReason) {
        warnings.push(
          `Over-received ${line.quantityReceived} on PO item ${poItem?.id}. Reason: ${line.overReceiveReason}`,
        );
      }

      // Upsert GRN item
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

      if (matchingGrnItem?.id) {
        const updateError = await writeGrnItem(
          service,
          'update',
          grnItemData,
          (query) => query.eq('id', String(matchingGrnItem.id)),
        );
        if (updateError) {
          return serverError(updateError);
        }
        Object.assign(matchingGrnItem, grnItemData);
      } else {
        const insertError = await writeGrnItem(service, 'insert', grnItemData);
        if (insertError) {
          return serverError(insertError);
        }
        existingGrnItemsResult.push({ id: `pending-${line.itemId}`, ...grnItemData });
      }
    }

    // Move to approval queue. Stock is still not posted at this point.
    const { data: updated, error: updateErr } = await service
      .from('goods_received_notes')
      .update({
        quality_status: 'PENDING_APPROVAL',
        notes: body.notes ?? (g.notes as string | null),
        received_by: ctx.userId,
        received_date: new Date().toISOString(),
        status: 'RECEIVED',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    await recordAuditLog({
      action: 'GRN_SUBMITTED',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: {
        itemCount: body.items.length,
        qualityStatus: 'PENDING_APPROVAL',
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

function isMissingColumnError(error: { message?: string } | null | undefined, table: string, columnName: string) {
  return (error?.message ?? '').includes(`column ${table}.${columnName} does not exist`);
}

async function loadGrnForReceive(
  service: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  grnId: string,
) {
  const primary = await service
    .from('goods_received_notes')
    .select('id, status, warehouse_id, purchase_order_id, grn_number, notes')
    .is('deleted_at', null)
    .eq('organization_id', organizationId)
    .eq('id', grnId)
    .maybeSingle();

  if (!primary.error) {
    return primary.data ?? null;
  }

  const compatibleLegacy =
    isMissingColumnError(primary.error, 'goods_received_notes', 'purchase_order_id') ||
    isMissingColumnError(primary.error, 'goods_received_notes', 'deleted_at');
  if (!compatibleLegacy) {
    throw new Error(primary.error.message);
  }

  const fallback = await service
    .from('goods_received_notes')
    .select('id, status, warehouse_id, po_id, grn_number, notes')
    .eq('organization_id', organizationId)
    .eq('id', grnId)
    .maybeSingle();
  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return fallback.data ?? null;
}

function resolveGrnPurchaseOrderId(grn: Record<string, unknown>) {
  const purchaseOrderId = grn.purchase_order_id ?? grn.po_id;
  return purchaseOrderId ? String(purchaseOrderId) : null;
}

async function loadPurchaseOrderItems(
  service: ReturnType<typeof createServiceRoleClient>,
  purchaseOrderId: string,
) {
  const primary = await service
    .from('purchase_order_items')
    .select('id, item_id, quantity_ordered, quantity_received, unit_cost')
    .eq('purchase_order_id', purchaseOrderId);
  if (!primary.error) {
    return (primary.data ?? []) as Record<string, unknown>[];
  }

  if (!isMissingColumnError(primary.error, 'purchase_order_items', 'purchase_order_id')) {
    throw new Error(primary.error.message);
  }

  const fallback = await service
    .from('purchase_order_items')
    .select('id, item_id, quantity_ordered, received_qty, unit_cost')
    .eq('po_id', purchaseOrderId);
  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return (fallback.data ?? []).map((item) => ({
    ...item,
    quantity_received: item.received_qty,
  })) as Record<string, unknown>[];
}

async function loadExistingGrnItems(
  service: ReturnType<typeof createServiceRoleClient>,
  grnId: string,
) {
  const primary = await service
    .from('goods_received_note_items')
    .select('id, item_id, po_item_id, quantity_expected, unit_cost')
    .eq('grn_id', grnId);
  if (!primary.error) {
    return (primary.data ?? []) as Record<string, unknown>[];
  }

  if (!primary.error.message.includes('goods_received_note_items')) {
    return primary.error.message;
  }

  const fallback = await service
    .from('grn_items')
    .select('id, item_id, po_item_id, ordered_qty, unit_cost')
    .eq('grn_id', grnId);
  if (fallback.error) {
    return fallback.error.message;
  }

  return (fallback.data ?? []).map((item) => ({
    ...item,
    quantity_expected: item.ordered_qty,
  })) as Record<string, unknown>[];
}
