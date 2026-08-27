import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  derivePurchaseOrderStatus,
  isPurchaseOrderApprovable,
  normalizePurchaseOrderSupplierId,
} from '@/lib/procurement-purchase-orders';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const PURCHASE_ORDER_DETAIL_SELECT_BASE = `id, po_number, order_date, expected_delivery_date, status, approval_status,
         subtotal, tax_amount, discount_amount, total, notes, approved_at, approved_by, approver_user_id, sent_at, rejected_at, requisition_id, supplier_id,
         suppliers(id, name, email, phone, address)`;
const PURCHASE_ORDER_DETAIL_SELECT_WITH_APPROVER_DETAILS = `id, po_number, order_date, expected_delivery_date, status, approval_status,
         subtotal, tax_amount, discount_amount, total, notes, approved_at, approved_by, approver_user_id, approver_name, approver_email, approval_notes, sent_at, rejected_at, requisition_id, supplier_id,
         suppliers(id, name, email, phone, address)`;

function stripMissingOptionalHeaderColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  for (const column of ['approver_name', 'approver_email', 'approval_notes'] as const) {
    if (isMissingColumnError(error, 'purchase_orders', column)) {
      const nextPayload = { ...payload };
      delete nextPayload[column];
      return nextPayload;
    }
  }

  return null;
}

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
    let response = await service
      .from('purchase_orders')
      .select(PURCHASE_ORDER_DETAIL_SELECT_WITH_APPROVER_DETAILS)
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (
      response.error &&
      ['approver_name', 'approver_email', 'approval_notes'].some((column) =>
        isMissingColumnError(response.error, 'purchase_orders', column),
      )
    ) {
      response = await service
        .from('purchase_orders')
        .select(PURCHASE_ORDER_DETAIL_SELECT_BASE)
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .maybeSingle();
    }

    const { data: order, error } = response;

    if (error) return serverError(error.message);
    if (!order) return notFound('Purchase order not found.');

    const [itemsRes, grnsPrimary] = await Promise.all([
      service
        .from('purchase_order_items')
        .select('id, description, quantity_ordered, quantity_received, unit_cost, unit_price, total_cost, total_ex_vat, tax_rate, unit_of_measure_id, items(id, code, name, description, unit_of_measure_id)')
        .eq('purchase_order_id', id)
        .order('created_at', { ascending: true }),
      service
        .from('goods_received_notes')
        .select('id, grn_number, received_date, status, quality_status')
        .eq('purchase_order_id', id)
        .order('received_date', { ascending: false }),
    ]);

    const grnsRes =
      grnsPrimary.error && isMissingColumnError(grnsPrimary.error, 'goods_received_notes', 'purchase_order_id')
        ? await service
            .from('goods_received_notes')
            .select('id, grn_number, received_date, status, quality_status')
            .eq('po_id', id)
            .order('received_date', { ascending: false })
        : grnsPrimary;

    if (itemsRes.error) return serverError(itemsRes.error.message);
    if (grnsRes.error) return serverError(grnsRes.error.message);

    const unitIds = [
      ...new Set(
        (itemsRes.data ?? [])
          .map((item) => {
            const product = Array.isArray(item.items) ? item.items[0] : item.items;
            return String(item.unit_of_measure_id ?? (product as Record<string, unknown> | null)?.unit_of_measure_id ?? '');
          })
          .filter(Boolean),
      ),
    ];
    const unitsRes = unitIds.length
      ? await service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
      : { data: [], error: null };
    if (unitsRes.error) return serverError(unitsRes.error.message);

    const grnIds = (grnsRes.data ?? []).map((row) => String(row.id));
    const grnItemCounts = new Map<string, number>();
    if (grnIds.length) {
      const grnItemsRes = await service.from('goods_received_note_items').select('grn_id').in('grn_id', grnIds);
      if (!grnItemsRes.error) {
        for (const row of grnItemsRes.data ?? []) {
          const grnId = String(row.grn_id ?? '');
          if (!grnId) continue;
          grnItemCounts.set(grnId, (grnItemCounts.get(grnId) ?? 0) + 1);
        }
      }
    }

    const o = order as Record<string, unknown>;
    const unitsById = new Map((unitsRes.data ?? []).map((unit) => [String(unit.id), unit]));

    return NextResponse.json({
      id: o.id,
      poNumber: o.po_number,
      orderDate: o.order_date,
      expectedDeliveryDate: o.expected_delivery_date,
      status: derivePurchaseOrderStatus({
        approvalStatus: o.approval_status,
        approvedAt: o.approved_at,
        approvedBy: o.approved_by,
        rejectedAt: o.rejected_at,
        sentAt: o.sent_at,
        status: o.status,
      }),
      approvedAt: o.approved_at ? String(o.approved_at) : null,
      approvedBy: o.approved_by ? String(o.approved_by) : null,
      approverName: o.approver_name ? String(o.approver_name) : null,
      approverEmail: o.approver_email ? String(o.approver_email) : null,
      approverUserId: o.approver_user_id ? String(o.approver_user_id) : null,
      approvalNotes: o.approval_notes ? String(o.approval_notes) : null,
      sentAt: o.sent_at ? String(o.sent_at) : null,
      rejectedAt: o.rejected_at ? String(o.rejected_at) : null,
      requisitionId: o.requisition_id ? String(o.requisition_id) : null,
      notes: o.notes ? String(o.notes) : null,
      supplierId: o.supplier_id ? String(o.supplier_id) : null,
      subtotal: Number(o.subtotal ?? 0),
      taxAmount: Number(o.tax_amount ?? 0),
      discountAmount: Number(o.discount_amount ?? 0),
      total: Number(o.total ?? 0),
      supplier: o.suppliers
        ? {
            id: (o.suppliers as Record<string, unknown>).id,
            name: (o.suppliers as Record<string, unknown>).name,
            email: (o.suppliers as Record<string, unknown>).email ?? null,
            phone: (o.suppliers as Record<string, unknown>).phone ?? null,
            address: (o.suppliers as Record<string, unknown>).address ?? null,
          }
        : null,
      items: (itemsRes.data ?? []).map((item) => {
        const product = Array.isArray(item.items) ? item.items[0] : item.items;
        const resolvedUnitId = String(
          item.unit_of_measure_id ?? (product as Record<string, unknown> | null)?.unit_of_measure_id ?? '',
        );
        const unit = unitsById.get(resolvedUnitId);
        return {
          id: item.id,
          description: item.description ? String(item.description) : product?.description ? String((product as Record<string, unknown>).description ?? '') : product?.name ? String((product as Record<string, unknown>).name ?? '') : '',
          quantityOrdered: Number(item.quantity_ordered ?? 0),
          quantityReceived: Number(item.quantity_received ?? 0),
          previouslyPostedReceivedQuantity: Number(item.quantity_received ?? 0),
          outstandingQuantity: Math.max(0, Number(item.quantity_ordered ?? 0) - Number(item.quantity_received ?? 0)),
          remainingQuantity: Math.max(0, Number(item.quantity_ordered ?? 0) - Number(item.quantity_received ?? 0)),
          taxRate: Number(item.tax_rate ?? 0),
          totalCost: Number(item.total_ex_vat ?? item.total_cost ?? 0),
          unitCost: Number(item.unit_price ?? item.unit_cost ?? 0),
          item: product
            ? {
                id: (product as Record<string, unknown>).id,
                code: (product as Record<string, unknown>).code,
                description: (product as Record<string, unknown>).description ?? null,
                name: (product as Record<string, unknown>).name,
              }
            : null,
          unitOfMeasure: unit
            ? {
                id: String(unit.id),
                name: String(unit.name ?? ''),
                abbreviation: String(unit.abbreviation ?? ''),
              }
            : null,
        };
      }),
      grns: (grnsRes.data ?? []).map((grn) => ({
        id: grn.id,
        grnNumber: grn.grn_number,
        receivedDate: grn.received_date,
        status: grn.status,
        qualityStatus: grn.quality_status,
        itemsCount: grnItemCounts.get(String(grn.id)) ?? 0,
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
    supplier_id?: string;
    orderDate?: string | null;
    expectedDeliveryDate?: string | null;
    notes?: string | null;
    taxAmount?: number;
    discountAmount?: number;
    approverName?: string | null;
    approverEmail?: string | null;
    approverUserId?: string | null;
    approvalNotes?: string | null;
    items?: Array<{
      description?: string | null;
      id?: string;
      itemId: string;
      unitOfMeasureId: string;
      quantityOrdered: number;
      taxRate?: number;
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
      .select('id, status, subtotal, tax_amount, discount_amount, purchase_order_items(id, item_id, unit_of_measure_id, quantity_ordered, quantity_received, unit_cost)')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase order not found.');

    const order = existing as Record<string, unknown>;
    if (!isPurchaseOrderApprovable(order.status)) {
      return badRequest('Only draft purchase orders can be edited.');
    }

    const supplierId = normalizePurchaseOrderSupplierId(body);
    const shouldValidateSupplier = body.supplierId !== undefined || body.supplier_id !== undefined;

    if (shouldValidateSupplier) {
      let { data: supplier, error: supplierError } = await service
        .from('suppliers')
        .select('id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', supplierId)
        .single();

      if (supplierError && isMissingColumnError(supplierError, 'suppliers', 'deleted_at')) {
        const fallback = await service
          .from('suppliers')
          .select('id')
          .eq('organization_id', ctx.organizationId)
          .eq('id', supplierId)
          .single();
        supplier = fallback.data;
        supplierError = fallback.error;
      }

      if (!supplierId || supplierError || !supplier) {
        return badRequest('Selected supplier is no longer available. Please refresh and try again.');
      }
    }

    // Validate items if provided
    if (body.items?.length) {
      const itemIds = [...new Set(body.items.map((i) => i.itemId))];
      const unitIds = [...new Set(body.items.map((i) => i.unitOfMeasureId))];
      const [itemsPrimary, unitsCheck] = await Promise.all([
        service.from('items').select('id').is('deleted_at', null).eq('organization_id', ctx.organizationId).in('id', itemIds),
        service.from('units_of_measure').select('id').eq('organization_id', ctx.organizationId).in('id', unitIds),
      ]);

      const itemsCheck =
        itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'items', 'deleted_at')
          ? await service.from('items').select('id').eq('organization_id', ctx.organizationId).in('id', itemIds)
          : itemsPrimary;

      if (
        (itemsCheck.data?.length ?? 0) !== itemIds.length ||
        (unitsCheck.data?.length ?? 0) !== unitIds.length
      ) {
        return badRequest('One or more purchase order items are invalid.');
      }
    }

    if (body.approverUserId) {
      const { data: approver } = await service
        .from('users')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('status', 'active')
        .eq('id', body.approverUserId)
        .single();

      if (!approver) {
        return badRequest('Selected approver is not available.');
      }
    }

    // Recalculate totals
    const nextItems = body.items
      ? body.items
      : ((order.purchase_order_items as Record<string, unknown>[]) ?? []).map((i) => ({
          itemId: i.item_id as string,
          id: i.id as string,
          unitOfMeasureId: i.unit_of_measure_id as string,
          quantityOrdered: Number(i.quantity_ordered ?? 0),
          unitCost: Number(i.unit_cost ?? 0),
        }));
    const taxAmount = body.taxAmount !== undefined ? body.taxAmount : Number(order.tax_amount ?? 0);
    const discountAmount = body.discountAmount !== undefined ? body.discountAmount : Number(order.discount_amount ?? 0);
    const subtotal = nextItems.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
    const total = subtotal + taxAmount - discountAmount;

    const updatePayload: Record<string, unknown> = { subtotal, total };
    if (shouldValidateSupplier) updatePayload.supplier_id = supplierId;
    if (body.orderDate !== undefined) updatePayload.order_date = body.orderDate;
    if (body.expectedDeliveryDate !== undefined) updatePayload.expected_delivery_date = body.expectedDeliveryDate;
    if (body.notes !== undefined) updatePayload.notes = body.notes;
    if (body.approverName !== undefined) updatePayload.approver_name = body.approverName?.trim() || null;
    if (body.approverEmail !== undefined) updatePayload.approver_email = body.approverEmail?.trim() || null;
    if (body.taxAmount !== undefined) updatePayload.tax_amount = body.taxAmount;
    if (body.discountAmount !== undefined) updatePayload.discount_amount = body.discountAmount;
    if (body.approverUserId !== undefined) updatePayload.approver_user_id = body.approverUserId;
    if (body.approvalNotes !== undefined) updatePayload.approval_notes = body.approvalNotes?.trim() || null;

    let { error: updateErr } = await service
      .from('purchase_orders')
      .update(updatePayload)
      .eq('id', id);
    while (updateErr) {
      const nextPayload = stripMissingOptionalHeaderColumn(updatePayload, updateErr);
      if (!nextPayload || JSON.stringify(nextPayload) === JSON.stringify(updatePayload)) {
        break;
      }
      Object.keys(updatePayload).forEach((key) => delete updatePayload[key]);
      Object.assign(updatePayload, nextPayload);
      const retry = await service.from('purchase_orders').update(updatePayload).eq('id', id);
      updateErr = retry.error;
    }
    if (updateErr) return serverError(updateErr.message);

    // Reconcile draft lines without losing received quantities or stable line IDs.
    if (body.items) {
      const existingItems = ((order.purchase_order_items as Record<string, unknown>[]) ?? []);
      const existingById = new Map(existingItems.map((item) => [String(item.id), item]));
      const submittedIds = new Set(body.items.map((item) => item.id).filter(Boolean).map(String));

      for (const item of body.items) {
        if (!item.id) continue;
        const existingItem = existingById.get(String(item.id));
        if (!existingItem) return badRequest('One or more purchase order lines are no longer available. Please refresh and try again.');
        const receivedQuantity = Number(existingItem.quantity_received ?? 0);
        if (item.quantityOrdered < receivedQuantity) {
          return badRequest('Ordered quantity cannot be reduced below quantity already received.');
        }
      }

      for (const existingItem of existingItems) {
        const lineId = String(existingItem.id);
        if (submittedIds.has(lineId)) continue;
        const receivedQuantity = Number(existingItem.quantity_received ?? 0);
        if (receivedQuantity > 0) {
          return badRequest('Cannot remove a purchase order line that has received stock.');
        }
        const deleteResult = await service.from('purchase_order_items').delete().eq('id', lineId);
        if (deleteResult.error) return serverError(deleteResult.error.message);
      }

      for (const item of body.items) {
        const lineTotal = item.quantityOrdered * item.unitCost;
        const payload = {
          description: item.description?.trim() || null,
          item_id: item.itemId,
          quantity_ordered: item.quantityOrdered,
          tax_rate: Number(item.taxRate ?? 0),
          total_cost: lineTotal,
          unit_cost: item.unitCost,
          unit_of_measure_id: item.unitOfMeasureId,
          updated_at: new Date().toISOString(),
        };

        if (item.id) {
          const updateResult = await service
            .from('purchase_order_items')
            .update(payload)
            .eq('id', item.id)
            .eq('purchase_order_id', id);
          if (updateResult.error) return serverError(updateResult.error.message);
        } else {
          const insertResult = await service.from('purchase_order_items').insert({
            ...payload,
            purchase_order_id: id,
            quantity_received: 0,
          });
          if (insertResult.error) return serverError(insertResult.error.message);
        }
      }
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
