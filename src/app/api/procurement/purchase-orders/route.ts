import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  normalizePurchaseOrderItemId,
  normalizePurchaseOrderQuantity,
  normalizePurchaseOrderRequisitionId,
  normalizePurchaseOrderSupplierId,
  normalizePurchaseOrderUnitOfMeasureId,
  normalizePurchaseOrderUnitPrice,
  derivePurchaseOrderStatus,
  normalizePurchaseOrderStatus,
} from '@/lib/procurement-purchase-orders';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const LEGACY_PURCHASE_ORDER_ITEM_COLUMNS = ['po_id', 'quantity', 'unit_price', 'tax_rate', 'line_total', 'received_qty'] as const;
const PURCHASE_ORDER_SELECT_BASE = `id, po_number, order_date, expected_delivery_date, status, total, approver_user_id, approved_by, approved_at, sent_at, rejected_at,
         requisition_id,
         suppliers(id, name),
         purchase_order_items(id)`;
const PURCHASE_ORDER_SELECT_WITH_APPROVER_DETAILS = `id, po_number, order_date, expected_delivery_date, status, total, approver_user_id, approver_name, approver_email, approval_notes, approved_by, approved_at, sent_at, rejected_at,
         requisition_id,
         suppliers(id, name),
         purchase_order_items(id)`;
const APPROVED_REQUISITION_STATUSES = ['approved', 'level1_approved'] as const;

function stripMissingLegacyPurchaseOrderItemColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  const column = LEGACY_PURCHASE_ORDER_ITEM_COLUMNS.find((entry) =>
    isMissingColumnError(error, 'purchase_order_items', entry),
  );
  if (!column) return null;

  const nextPayload = { ...payload };
  delete nextPayload[column];
  return nextPayload;
}

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

function isApprovedRequisitionStatus(status: unknown, approvalStatus: unknown) {
  const candidates = [status, approvalStatus].map((value) => String(value ?? '').trim().toLowerCase());
  return candidates.some((value) => APPROVED_REQUISITION_STATUSES.includes(value as (typeof APPROVED_REQUISITION_STATUSES)[number]));
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status');
  const supplierId = searchParams.get('supplierId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = service
      .from('purchase_orders')
      .select(PURCHASE_ORDER_SELECT_WITH_APPROVER_DETAILS, { count: 'exact' })
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false });

    if (status) {
      const normalizedStatus = normalizePurchaseOrderStatus(status);
      if (normalizedStatus === 'REJECTED') {
        query = query.not('rejected_at', 'is', null);
      } else {
        const variants = [...new Set([status, status.toLowerCase(), status.toUpperCase()])];
        query = query.in('status', variants);
      }
    }
    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (startDate) query = query.gte('order_date', startDate);
    if (endDate) query = query.lte('order_date', endDate);

    const from = (page - 1) * pageSize;
    let { data, count, error } = await query.range(from, from + pageSize - 1);

    if (
      error &&
      ['approver_name', 'approver_email', 'approval_notes'].some((column) =>
        isMissingColumnError(error, 'purchase_orders', column),
      )
    ) {
      let fallbackQuery = service
        .from('purchase_orders')
        .select(PURCHASE_ORDER_SELECT_BASE, { count: 'exact' })
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .order('created_at', { ascending: false });

      if (status) {
        const normalizedStatus = normalizePurchaseOrderStatus(status);
        if (normalizedStatus === 'REJECTED') {
          fallbackQuery = fallbackQuery.not('rejected_at', 'is', null);
        } else {
          const variants = [...new Set([status, status.toLowerCase(), status.toUpperCase()])];
          fallbackQuery = fallbackQuery.in('status', variants);
        }
      }
      if (supplierId) fallbackQuery = fallbackQuery.eq('supplier_id', supplierId);
      if (startDate) fallbackQuery = fallbackQuery.gte('order_date', startDate);
      if (endDate) fallbackQuery = fallbackQuery.lte('order_date', endDate);

      const fallback = await fallbackQuery.range(from, from + pageSize - 1);
      data = fallback.data;
      count = fallback.count;
      error = fallback.error;
    }

    if (error) return serverError(error.message);

    const userIds = [
      ...new Set(
        (data ?? [])
          .flatMap((row) => [row.approver_user_id, row.approved_by])
          .map((value) => String(value ?? ''))
          .filter(Boolean),
      ),
    ];
    const usersResult = userIds.length
      ? await service.from('users').select('id, full_name').in('id', userIds)
      : { data: [], error: null };
    if (usersResult.error) return serverError(usersResult.error.message);
    const usersById = new Map((usersResult.data ?? []).map((row) => [String(row.id), String(row.full_name ?? 'Unknown')]));

    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      poNumber: r.po_number,
      orderDate: r.order_date,
      expectedDeliveryDate: r.expected_delivery_date,
      status: derivePurchaseOrderStatus({
        rejectedAt: r.rejected_at,
        sentAt: r.sent_at,
        status: r.status,
      }),
      approverName: usersById.get(String(r.approver_user_id ?? '')) ?? (r.approver_name ? String(r.approver_name) : null),
      approverEmail: r.approver_email ? String(r.approver_email) : null,
      approverUserId: r.approver_user_id ? String(r.approver_user_id) : null,
      approvalNotes: r.approval_notes ? String(r.approval_notes) : null,
      approvedBy: usersById.get(String(r.approved_by ?? '')) ?? null,
      approvedAt: r.approved_at ? String(r.approved_at) : null,
      sentAt: r.sent_at ? String(r.sent_at) : null,
      rejectedAt: r.rejected_at ? String(r.rejected_at) : null,
      requisitionId: r.requisition_id ? String(r.requisition_id) : null,
      total: Number(r.total ?? 0),
      supplier: r.suppliers
        ? { id: (r.suppliers as Record<string, unknown>).id, name: (r.suppliers as Record<string, unknown>).name }
        : null,
      itemsCount: Array.isArray(r.purchase_order_items) ? (r.purchase_order_items as unknown[]).length : 0,
    }));

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();

  let body: {
    supplierId?: string;
    supplier_id?: string;
    requisitionId?: string | null;
    requisition_id?: string | null;
    orderDate?: string | null;
    expectedDeliveryDate?: string | null;
    notes?: string | null;
    taxAmount?: number;
    discountAmount?: number;
    approverName?: string | null;
    approverEmail?: string | null;
    approverUserId?: string | null;
    approvalNotes?: string | null;
    items: Array<{
      itemId?: string;
      item_id?: string;
      unitOfMeasureId?: string;
      unit_of_measure_id?: string;
      uomId?: string;
      uom_id?: string;
      quantityOrdered?: number;
      quantity_ordered?: number;
      quantity?: number;
      qty?: number;
      unitCost?: number;
      unit_cost?: number;
      unitPrice?: number;
      unit_price?: number;
      price?: number;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const supplierId = normalizePurchaseOrderSupplierId(body);
  const requisitionId = normalizePurchaseOrderRequisitionId(body);
  const normalizedItems = (body.items ?? []).map((item) => ({
    itemId: normalizePurchaseOrderItemId(item),
    quantityOrdered: normalizePurchaseOrderQuantity(item),
    unitCost: normalizePurchaseOrderUnitPrice(item),
    unitOfMeasureId: normalizePurchaseOrderUnitOfMeasureId(item),
  }));

  if (!supplierId) {
    return badRequest('Please select a supplier.');
  }

  if (!normalizedItems.length) {
    return badRequest('Please select a requisition or add items manually.');
  }

  try {
    // Validate supplier
    let { data: supplier, error: supErr } = await service
      .from('suppliers')
      .select('id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', supplierId)
      .single();

    if (supErr && isMissingColumnError(supErr, 'suppliers', 'deleted_at')) {
      const fallback = await service
        .from('suppliers')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('id', supplierId)
        .single();
      supplier = fallback.data;
      supErr = fallback.error;
    }

    if (supErr || !supplier) {
      return badRequest('Selected supplier is no longer available. Please refresh and try again.');
    }

    // Validate requisition if provided
    if (requisitionId) {
      const { data: req, error: reqErr } = await service
        .from('purchase_requisitions')
        .select('id, status, approval_status')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', requisitionId)
        .single();

      if (reqErr || !req) return badRequest('Selected requisition is no longer available. Please refresh and try again.');
      if (!isApprovedRequisitionStatus((req as Record<string, unknown>).status, (req as Record<string, unknown>).approval_status)) {
        return badRequest('Selected requisition is no longer available. Please refresh and try again.');
      }
    }

    // Validate items
    if (normalizedItems.some((item) => !item.itemId)) {
      return badRequest('Please select an item for every PO line.');
    }
    if (normalizedItems.some((item) => Number.isNaN(item.quantityOrdered) || item.quantityOrdered <= 0)) {
      return badRequest('Please enter a valid quantity.');
    }
    if (normalizedItems.some((item) => Number.isNaN(item.unitCost) || item.unitCost < 0)) {
      return badRequest('Purchase order could not be created. Please check the required fields and try again.');
    }

    const itemIds = [...new Set(normalizedItems.map((i) => i.itemId))];
    const unitIds = [...new Set(normalizedItems.map((i) => i.unitOfMeasureId).filter(Boolean))];
    const [itemsPrimary, unitsCheck] = await Promise.all([
      service.from('items').select('id').is('deleted_at', null).eq('organization_id', ctx.organizationId).in('id', itemIds),
      unitIds.length
        ? service.from('units_of_measure').select('id').eq('organization_id', ctx.organizationId).in('id', unitIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const itemsCheck =
      itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'items', 'deleted_at')
        ? await service.from('items').select('id').eq('organization_id', ctx.organizationId).in('id', itemIds)
        : itemsPrimary;

    if ((itemsCheck.data?.length ?? 0) !== itemIds.length) {
      return badRequest('Selected item is no longer available. Please refresh and try again.');
    }
    if ((unitsCheck.data?.length ?? 0) !== unitIds.length) {
      return badRequest('Selected unit of measurement is no longer available. Please refresh and try again.');
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

    // Generate PO number
    const { count: poCount } = await service
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const poNumber = `PO-${String((poCount ?? 0) + 1).padStart(5, '0')}`;
    const taxAmount = body.taxAmount ?? 0;
    const discountAmount = body.discountAmount ?? 0;
    const subtotal = normalizedItems.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
    const total = subtotal + taxAmount - discountAmount;

    let orderPayload: Record<string, unknown> = {
      po_number: poNumber,
      supplier_id: supplierId,
      requisition_id: requisitionId || null,
      order_date: body.orderDate ?? new Date().toISOString(),
      expected_delivery_date: body.expectedDeliveryDate ?? null,
      notes: body.notes ?? null,
      approver_name: body.approverName?.trim() || null,
      approver_email: body.approverEmail?.trim() || null,
      approver_user_id: body.approverUserId ?? null,
      approval_notes: body.approvalNotes?.trim() || null,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      status: 'DRAFT',
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      approved_at: null,
      approved_by: null,
    };
    let orderInsert = await service.from('purchase_orders').insert(orderPayload).select().single();
    while (orderInsert.error) {
      const nextPayload = stripMissingOptionalHeaderColumn(orderPayload, orderInsert.error);
      if (!nextPayload || JSON.stringify(nextPayload) === JSON.stringify(orderPayload)) {
        break;
      }
      orderPayload = nextPayload;
      orderInsert = await service.from('purchase_orders').insert(orderPayload).select().single();
    }

    if (orderInsert.error) return serverError(orderInsert.error.message);
    const order = orderInsert.data;

    const orderId = (order as Record<string, unknown>).id as string;

    let itemPayload = normalizedItems.map((item) => ({
      po_id: orderId,
      purchase_order_id: orderId,
      item_id: item.itemId,
      unit_of_measure_id: item.unitOfMeasureId || null,
      quantity: item.quantityOrdered,
      quantity_ordered: item.quantityOrdered,
      received_qty: 0,
      quantity_received: 0,
      unit_price: item.unitCost,
      unit_cost: item.unitCost,
      tax_rate: 0,
      line_total: item.quantityOrdered * item.unitCost,
      total_cost: item.quantityOrdered * item.unitCost,
    }));
    let { error: itemsErr } = await service.from('purchase_order_items').insert(itemPayload);
    while (itemsErr) {
      const nextPayload = itemPayload
        .map((row) => stripMissingLegacyPurchaseOrderItemColumn(row, itemsErr))
        .filter((row): row is Record<string, unknown> => Boolean(row));
      if (nextPayload.length !== itemPayload.length) break;
      if (JSON.stringify(nextPayload) === JSON.stringify(itemPayload)) break;
      itemPayload = nextPayload;
      const retry = await service.from('purchase_order_items').insert(itemPayload);
      itemsErr = retry.error;
    }

    if (itemsErr) return serverError(itemsErr.message);

    // Update requisition status if linked
    if (requisitionId) {
      await service
        .from('purchase_requisitions')
        .update({ status: 'po_created' })
        .eq('id', requisitionId);
    }

    const { data: full } = await service
      .from('purchase_orders')
      .select('*, purchase_order_items(*), suppliers(id, name)')
      .eq('id', orderId)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        purchase_order_id: orderId,
        purchaseOrderId: orderId,
        po_number: String((full as Record<string, unknown> | null)?.po_number ?? poNumber),
        poNumber: String((full as Record<string, unknown> | null)?.po_number ?? poNumber),
        requisition_id: requisitionId || null,
        requisitionId: requisitionId || null,
      },
    }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
