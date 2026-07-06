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

  const { id } = await params;
  const service = createServiceRoleClient();

  let securityUserId = ctx.userId;
  let isStoreKeeper =
    ctx.roles.some((role) => role.name.toLowerCase() === 'store keeper') ||
    ctx.role.toLowerCase() === 'store keeper' ||
    ctx.role.toLowerCase() === 'store_keeper';

  const hasStoreKeeperRole = async (userProfileId: string) => {
    const { data: roleLinks } = await service
      .from('user_roles')
      .select('role_id')
      .eq('user_profile_id', userProfileId);

    const roleIds = Array.from(
      new Set(
        (roleLinks ?? [])
          .map((row) => String((row as Record<string, unknown>).role_id ?? ''))
          .filter((roleId): roleId is string => Boolean(roleId)),
      ),
    );

    if (roleIds.length === 0) return false;

    const { data: roleRows } = await service
      .from('roles')
      .select('name')
      .in('id', roleIds);

    return (roleRows ?? []).some(
      (role) => String((role as Record<string, unknown>).name ?? '').toLowerCase() === 'store keeper',
    );
  };

  if (!isStoreKeeper) {
    isStoreKeeper = await hasStoreKeeperRole(ctx.userId);
  }

  if (!isStoreKeeper && ctx.workId) {
    const { data: userRow } = await service
      .from('users')
      .select('id')
      .eq('work_id', ctx.workId)
      .maybeSingle();

    const userIdFromWorkId = String((userRow as Record<string, unknown> | null)?.id ?? '');

    if (userIdFromWorkId) {
      securityUserId = userIdFromWorkId;
      isStoreKeeper = await hasStoreKeeperRole(userIdFromWorkId);
    }
  }

  const canReceiveGrn =
    can(ctx, 'stores.grn.submit', 'stores.grn.edit', 'procurement.write', 'inventory.write') ||
    isStoreKeeper;

  if (!canReceiveGrn) return forbidden();

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
      .select('id, status, warehouse_id, purchase_order_id, po_id, grn_number, notes')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (grnErr || !grn) return notFound('Goods received note not found.');

    const g = grn as Record<string, unknown>;

    // Branch scope check via warehouse.
    // Check both branch scope and live DB warehouse assignments.
    if (ctx.isBranchScoped && ctx.branchId && !isStoreKeeper) {
      const warehouseId = String(g.warehouse_id ?? '');

      if (warehouseId) {
        const { data: wh } = await service
          .from('warehouses')
          .select('branch_id')
          .eq('id', warehouseId)
          .single();

        const warehouseBranchId = (wh as Record<string, unknown> | null)?.branch_id
          ? String((wh as Record<string, unknown>).branch_id)
          : null;

        const allowedBranchIds = new Set([ctx.branchId, ...ctx.branchAssignments].filter(Boolean));
        let hasWarehouseAssignment = ctx.warehouseAssignments.includes(warehouseId);

        if (!hasWarehouseAssignment) {
          const { data: warehouseAssignment } = await service
            .from('user_warehouse_assignments')
            .select('id')
            .eq('user_profile_id', securityUserId)
            .eq('warehouse_id', warehouseId)
            .eq('is_active', true)
            .maybeSingle();

          hasWarehouseAssignment = Boolean(warehouseAssignment);
        }

        if (
          !wh ||
          (warehouseBranchId && !allowedBranchIds.has(warehouseBranchId) && !hasWarehouseAssignment)
        ) {
          return forbidden();
        }
      }
    }

    if (g.status !== 'DRAFT') {
      return badRequest('Only draft GRNs can be submitted.');
    }

    const purchaseOrderId = String(g.purchase_order_id ?? g.po_id ?? '');
    let po: Record<string, unknown> | null = null;
    if (purchaseOrderId) {
      const { data: purchaseOrder, error: purchaseOrderError } = await service
        .from('purchase_orders')
        .select('id, purchase_order_items(*)')
        .eq('organization_id', ctx.organizationId)
        .eq('id', purchaseOrderId)
        .single();
      if (purchaseOrderError || !purchaseOrder) {
        return badRequest('Linked purchase order not found.');
      }
      po = purchaseOrder as Record<string, unknown>;
    }

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
      const existingGrnItem = purchaseOrderId
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
        status: 'RECEIVED',
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
        status: 'RECEIVED',
        warnings,
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    await recordAuditLog({
      action: 'GRN_POSTED',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: {
        itemCount: body.items.length,
        status: 'RECEIVED',
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
