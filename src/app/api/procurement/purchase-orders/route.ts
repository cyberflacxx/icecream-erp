import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isWarehouseAvailableToContext } from '@/lib/branch-access';
import {
  derivePurchaseOrderStatus,
  getPurchaseOrderReceivingLines,
  isApprovedRequisitionStatus,
  isPurchaseOrderEligibleForGoodsReceived,
  normalizePurchaseOrderItemId,
  normalizePurchaseOrderLineTotal,
  normalizePurchaseOrderQuantity,
  normalizePurchaseOrderRequisitionId,
  normalizePurchaseOrderSupplierId,
  normalizePurchaseOrderStatus,
  normalizePurchaseOrderTaxRate,
  normalizePurchaseOrderUnitOfMeasureId,
  normalizePurchaseOrderUnitPrice,
  resolvePurchaseOrderItemDescription,
  resolvePurchaseOrderItemUnitOfMeasureId,
  resolvePurchaseOrderItemUnitPrice,
} from '@/lib/procurement-purchase-orders';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const LEGACY_PURCHASE_ORDER_ITEM_COLUMNS = [
  'description',
  'line_total',
  'po_id',
  'purchase_order_id',
  'quantity',
  'quantity_ordered',
  'quantity_received',
  'received_qty',
  'requisition_item_id',
  'tax_amount',
  'tax_rate',
  'total_cost',
  'total_ex_vat',
  'unit_of_measure_id',
  'unit_price',
] as const;
const PURCHASE_ORDER_SELECT_BASE = `id, po_number, order_date, expected_delivery_date, status, approval_status, total, approver_user_id, approved_by, approved_at, sent_at, rejected_at,
         requisition_id,
         suppliers(id, name),
         purchase_order_items(id)`;
const PURCHASE_ORDER_SELECT_WITH_APPROVER_DETAILS = `id, po_number, order_date, expected_delivery_date, status, approval_status, total, approver_user_id, approver_name, approver_email, approval_notes, approved_by, approved_at, sent_at, rejected_at,
         requisition_id,
         suppliers(id, name),
         purchase_order_items(id)`;
function stripMissingLegacyPurchaseOrderItemColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  const column = LEGACY_PURCHASE_ORDER_ITEM_COLUMNS.find((entry) =>
    isMissingColumnError(error, 'purchase_order_items', entry),
  );
  if (!column) return null;

  const nextPayload = { ...payload };
  delete nextPayload[column];
  return nextPayload;
}

function logPurchaseOrderFailure(
  step: string,
  details: {
    header?: Record<string, unknown>;
    firstLine?: Record<string, unknown> | null;
    lineCount?: number;
    message: string;
  },
) {
  console.error('Purchase order create failed.', {
    firstLine: details.firstLine,
    header: details.header,
    lineCount: details.lineCount,
    message: details.message,
    step,
  });
}

function stripMissingOptionalHeaderColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  for (const column of [
    'approver_name',
    'approver_email',
    'approval_notes',
    'currency',
    'delivery_address',
    'supplier_quote',
  ] as const) {
    if (isMissingColumnError(error, 'purchase_orders', column)) {
      const nextPayload = { ...payload };
      delete nextPayload[column];
      return nextPayload;
    }
  }

  return null;
}

function firstString(...values: unknown[]) {
  return values
    .map((value) => String(value ?? '').trim())
    .find(Boolean) ?? '';
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActivePurchaseOrderForRequisitionConversion(row: Record<string, unknown>) {
  const status = normalizePurchaseOrderStatus(row.status);
  return !row.deleted_at && !row.rejected_at && !['CANCELLED', 'DELETED', 'REJECTED', 'VOID'].includes(status);
}

function poCreateFailure(
  status: number,
  details: {
    lineCount: number;
    missing?: string[];
    operation: string;
  },
) {
  const requestId = `PO-${Date.now()}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
  return NextResponse.json({
    success: false,
    error: {
      code: 'PO_CREATE_FAILED',
      message: 'Purchase order could not be created. Please check supplier, requisition items, quantities, and prices.',
      requestId,
    },
    message: 'Purchase order could not be created. Please check supplier, requisition items, quantities, and prices.',
    code: 'PO_CREATE_FAILED',
    requestId,
    details: {
      lineCount: details.lineCount,
      missing: details.missing ?? [],
      operation: details.operation,
    },
  }, { status });
}

async function rollbackCreatedPurchaseOrder(
  service: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
) {
  await service
    .from('purchase_order_items')
    .delete()
    .or(`purchase_order_id.eq.${orderId},po_id.eq.${orderId}`);

  await service
    .from('purchase_orders')
    .delete()
    .eq('id', orderId);
}

async function loadReceivablePurchaseOrderPickerRows(
  service: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  pageSize: number,
) {
  const ordersResult = await service
    .from('purchase_orders')
    .select('id, po_number, supplier_id, status, approval_status, approved_at, approved_by, sent_at, rejected_at, suppliers(id, name)')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (ordersResult.error) {
    return { data: null, error: ordersResult.error };
  }

  const orderIds = [...new Set((ordersResult.data ?? []).map((row) => String(row.id ?? '')).filter(Boolean))];
  const orderItemsResult = orderIds.length
    ? await service
        .from('purchase_order_items')
        .select('id, purchase_order_id, po_id, item_id, quantity, quantity_ordered, quantity_received, received_qty, unit_price, unit_cost, total_cost, total_ex_vat, line_total')
        .in('purchase_order_id', orderIds)
    : { data: [], error: null };

  const compatibleOrderItemsResult =
    orderItemsResult.error && isMissingColumnError(orderItemsResult.error, 'purchase_order_items', 'purchase_order_id')
      ? await service
          .from('purchase_order_items')
          .select('id, po_id, item_id, quantity, quantity_ordered, quantity_received, received_qty, unit_price, unit_cost, total_cost, total_ex_vat, line_total')
          .in('po_id', orderIds)
      : orderItemsResult;

  if (compatibleOrderItemsResult.error) {
    return { data: null, error: compatibleOrderItemsResult.error };
  }

  const itemsByOrderId = new Map<string, Array<Record<string, unknown>>>();
  for (const item of compatibleOrderItemsResult.data ?? []) {
    const orderId = String(item.purchase_order_id ?? item.po_id ?? '').trim();
    if (!orderId) continue;
    itemsByOrderId.set(orderId, [...(itemsByOrderId.get(orderId) ?? []), item as Record<string, unknown>]);
  }

  const data = (ordersResult.data ?? [])
    .map((row) => {
      const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
      const lines = itemsByOrderId.get(String(row.id)) ?? [];
      return {
        ...row,
        lines,
        receivingLines: getPurchaseOrderReceivingLines(lines),
        supplierActive: Boolean(row.supplier_id ?? supplier?.id),
      };
    })
    .filter((row) =>
      isPurchaseOrderEligibleForGoodsReceived({
        approvalStatus: row.approval_status,
        approvedAt: row.approved_at,
        approvedBy: row.approved_by,
        lines: row.lines,
        rejectedAt: row.rejected_at,
        sentAt: row.sent_at,
        status: row.status,
        supplierActive: row.supplierActive,
      }),
    );

  return { data, error: null };
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
  const picker = searchParams.get('picker') === 'true';
  const forGrn = searchParams.get('forGrn') === 'true';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    if (picker && forGrn) {
      const pickerRows = await loadReceivablePurchaseOrderPickerRows(service, ctx.organizationId, pageSize);
      if (pickerRows.error) return serverError(pickerRows.error.message);

      return NextResponse.json({
        success: true,
        data: (pickerRows.data ?? []).map((row) => {
            const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
            const supplierName = String(supplier?.name ?? 'Unknown supplier');
            return {
              id: String(row.id),
              po_number: String(row.po_number ?? ''),
              poNumber: String(row.po_number ?? ''),
              status: derivePurchaseOrderStatus({
                approvalStatus: row.approval_status,
                approvedAt: row.approved_at,
                approvedBy: row.approved_by,
                rejectedAt: row.rejected_at,
                sentAt: row.sent_at,
                status: row.status,
              }),
              supplier_id: row.supplier_id ? String(row.supplier_id) : supplier?.id ? String(supplier.id) : null,
              supplierId: row.supplier_id ? String(row.supplier_id) : supplier?.id ? String(supplier.id) : null,
              supplier_name: supplierName,
              supplierName,
              label: `${String(row.po_number ?? 'Purchase order')} - ${supplierName}`,
              remainingLines: row.receivingLines.map((line) => ({
                id: line.id,
                itemId: line.itemId,
                orderedQuantity: line.orderedQuantity,
                previouslyPostedReceivedQuantity: line.previouslyPostedReceivedQuantity,
                remainingQuantity: line.remainingQuantity,
              })),
            };
          }),
      });
    }

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
      data = fallback.data as typeof data;
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
        approvalStatus: r.approval_status,
        approvedAt: r.approved_at,
        approvedBy: r.approved_by,
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
    warehouseId?: string | null;
    warehouse_id?: string | null;
    deliveryAddress?: string | null;
    delivery_address?: string | null;
    supplierQuote?: string | null;
    supplier_quote?: string | null;
    quoteReference?: string | null;
    quote_reference?: string | null;
    currency?: string | null;
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
      cost?: number;
      description?: string | null;
      itemDescription?: string | null;
      item_description?: string | null;
      itemName?: string | null;
      specification?: string | null;
      requisitionItemId?: string | null;
      requisition_item_id?: string | null;
      taxRate?: number;
      tax_rate?: number;
      lineTotal?: number;
      line_total?: number;
    }>;
    allowOverRequisitionQuantity?: boolean;
    overrideOverRequisitionQuantity?: boolean;
  };
  let createdOrderId: string | null = null;

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const supplierId = normalizePurchaseOrderSupplierId(body);
  const requisitionId = normalizePurchaseOrderRequisitionId(body);
  const requestedWarehouseId = firstString(body.warehouse_id, body.warehouseId) || null;
  const deliveryAddress = firstString(body.delivery_address, body.deliveryAddress, body.warehouse_id, body.warehouseId) || null;
  const supplierQuote = firstString(body.supplier_quote, body.supplierQuote, body.quote_reference, body.quoteReference) || null;
  const currency = firstString(body.currency) || 'USD';
  const normalizedItems = (body.items ?? []).map((item) => ({
      itemId: normalizePurchaseOrderItemId(item),
      quantityOrdered: normalizePurchaseOrderQuantity(item),
      requestedLineTotal: normalizePurchaseOrderLineTotal(item),
      taxRate: normalizePurchaseOrderTaxRate(item),
      unitCost: normalizePurchaseOrderUnitPrice(item),
      unitOfMeasureId: normalizePurchaseOrderUnitOfMeasureId(item),
      requisitionItemId: firstString((item as Record<string, unknown>).requisition_item_id, (item as Record<string, unknown>).requisitionItemId),
      raw: item,
    }));
  const allowOverRequisitionQuantity = body.allowOverRequisitionQuantity === true || body.overrideOverRequisitionQuantity === true;
  let requisitionRemainingAfterCreate: Array<{ lineId: string; remainingAfterCreate: number }> = [];

  if (!supplierId) {
    return poCreateFailure(400, {
      lineCount: normalizedItems.length,
      missing: ['supplier_id'],
      operation: 'validate_purchase_order_header',
    });
  }

  if (!normalizedItems.length) {
    return poCreateFailure(400, {
      lineCount: 0,
      missing: ['items'],
      operation: 'validate_purchase_order_lines',
    });
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

    if (requestedWarehouseId) {
      const warehouseResult = await service
        .from('warehouses')
        .select('id, organization_id, branch_id, is_active, name')
        .eq('id', requestedWarehouseId)
        .maybeSingle();

      if (warehouseResult.error) {
        return serverError(warehouseResult.error.message);
      }

      const warehouse = warehouseResult.data
        ? {
            branchId: warehouseResult.data.branch_id ? String(warehouseResult.data.branch_id) : null,
            id: String(warehouseResult.data.id),
            isActive: warehouseResult.data.is_active !== false,
            name: warehouseResult.data.name ? String(warehouseResult.data.name) : null,
            organizationId: String(warehouseResult.data.organization_id ?? ''),
          }
        : null;

      if (!isWarehouseAvailableToContext(ctx, warehouse)) {
        return forbidden();
      }
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
        return badRequest('Only approved requisitions can be converted to purchase orders.');
      }

      const requestedRequisitionItemIds = normalizedItems.map((item) => item.requisitionItemId).filter(Boolean);
      if (requestedRequisitionItemIds.length !== normalizedItems.length) {
        return badRequest('Every PO line converted from a requisition must keep its requisition line reference.');
      }

      const requisitionItemsResult = await service
        .from('purchase_requisition_items')
        .select('id, requisition_id, pr_id, item_id, quantity, quantity_requested, quantity_approved')
        .in('id', requestedRequisitionItemIds);

      if (requisitionItemsResult.error) return serverError(requisitionItemsResult.error.message);

      const requisitionItemsById = new Map(
        (requisitionItemsResult.data ?? []).map((line) => [String(line.id), line as Record<string, unknown>]),
      );

      if (requisitionItemsById.size !== requestedRequisitionItemIds.length) {
        return badRequest('One or more requisition lines are no longer available. Please refresh and try again.');
      }

      for (const item of normalizedItems) {
        const requisitionItem = requisitionItemsById.get(item.requisitionItemId);
        const owningRequisitionId = String(requisitionItem?.requisition_id ?? requisitionItem?.pr_id ?? '');
        if (!requisitionItem || owningRequisitionId !== requisitionId || String(requisitionItem.item_id ?? '') !== item.itemId) {
          return badRequest('One or more PO lines do not belong to the selected approved requisition.');
        }
      }

      const poLinesResult = await service
        .from('purchase_order_items')
        .select('requisition_item_id, quantity_ordered, quantity, purchase_order_id, po_id')
        .in('requisition_item_id', requestedRequisitionItemIds);

      if (poLinesResult.error) return serverError(poLinesResult.error.message);

      const purchaseOrderIds = [
        ...new Set(
          (poLinesResult.data ?? [])
            .map((line) => String(line.purchase_order_id ?? line.po_id ?? ''))
            .filter(Boolean),
        ),
      ];
      const purchaseOrdersResult = purchaseOrderIds.length
        ? await service
            .from('purchase_orders')
            .select('id, status, rejected_at, deleted_at')
            .eq('organization_id', ctx.organizationId)
            .in('id', purchaseOrderIds)
        : { data: [], error: null };

      if (purchaseOrdersResult.error) return serverError(purchaseOrdersResult.error.message);

      const activePurchaseOrderIds = new Set(
        (purchaseOrdersResult.data ?? [])
          .filter((row) => isActivePurchaseOrderForRequisitionConversion(row as Record<string, unknown>))
          .map((row) => String(row.id)),
      );
      const convertedByLine = new Map<string, number>();
      for (const line of poLinesResult.data ?? []) {
        const poId = String(line.purchase_order_id ?? line.po_id ?? '');
        const requisitionItemId = String(line.requisition_item_id ?? '');
        if (!poId || !requisitionItemId || !activePurchaseOrderIds.has(poId)) continue;
        convertedByLine.set(requisitionItemId, (convertedByLine.get(requisitionItemId) ?? 0) + toNumber(line.quantity_ordered ?? line.quantity));
      }

      const currentRequestByLine = new Map<string, number>();
      for (const item of normalizedItems) {
        currentRequestByLine.set(
          item.requisitionItemId,
          (currentRequestByLine.get(item.requisitionItemId) ?? 0) + item.quantityOrdered,
        );
      }

      requisitionRemainingAfterCreate = [];
      for (const [lineId, requestedQuantity] of currentRequestByLine.entries()) {
        const requisitionItem = requisitionItemsById.get(lineId);
        const approvedQuantity = toNumber(
          requisitionItem?.quantity_approved ?? requisitionItem?.quantity_requested ?? requisitionItem?.quantity,
        );
        const alreadyConverted = convertedByLine.get(lineId) ?? 0;
        const remainingBeforeCreate = Math.max(0, approvedQuantity - alreadyConverted);

        if (requestedQuantity > remainingBeforeCreate && !allowOverRequisitionQuantity) {
          return badRequest(`Requisition line ${lineId} has already been fully converted or does not have enough remaining approved quantity.`);
        }

        requisitionRemainingAfterCreate.push({
          lineId,
          remainingAfterCreate: Math.max(0, remainingBeforeCreate - requestedQuantity),
        });
      }
    }

    // Validate items
    if (normalizedItems.some((item) => !item.itemId)) {
      return poCreateFailure(400, {
        lineCount: normalizedItems.length,
        missing: ['item_id'],
        operation: 'validate_purchase_order_lines',
      });
    }
    if (normalizedItems.some((item) => Number.isNaN(item.quantityOrdered) || item.quantityOrdered <= 0)) {
      return poCreateFailure(400, {
        lineCount: normalizedItems.length,
        missing: ['quantity'],
        operation: 'validate_purchase_order_lines',
      });
    }
    if (normalizedItems.some((item) => Number.isNaN(item.unitCost) || item.unitCost < 0)) {
      return poCreateFailure(400, {
        lineCount: normalizedItems.length,
        missing: ['unit_price'],
        operation: 'validate_purchase_order_lines',
      });
    }

    const itemIds = [...new Set(normalizedItems.map((i) => i.itemId))];
    const unitIds = [...new Set(normalizedItems.map((i) => i.unitOfMeasureId).filter(Boolean))];
    const [itemsPrimary, unitsCheck] = await Promise.all([
      service
        .from('items')
        .select('id, code, name, description, purchase_price, cost_price, unit_cost, standard_cost, default_purchase_price, price, selling_price, unit_of_measure_id, uom_id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .in('id', itemIds),
      unitIds.length
        ? service.from('units_of_measure').select('id').eq('organization_id', ctx.organizationId).in('id', unitIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const itemsCheck =
      itemsPrimary.error
        ? await service
            .from('items')
            .select('id, code, name')
            .eq('organization_id', ctx.organizationId)
            .in('id', itemIds)
        : itemsPrimary;

    if (itemsCheck.error) {
      return poCreateFailure(500, {
        lineCount: normalizedItems.length,
        operation: 'validate_purchase_order_items',
      });
    }
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

    const itemsById = new Map(
      (itemsCheck.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
    );

    const resolvedItems = normalizedItems.map((item) => {
      const itemRow = itemsById.get(item.itemId);
      const resolvedUnitCost =
        item.unitCost > 0 || !itemRow ? item.unitCost : resolvePurchaseOrderItemUnitPrice(itemRow);
      const resolvedUnitId = item.unitOfMeasureId || resolvePurchaseOrderItemUnitOfMeasureId(itemRow) || null;
      return {
        description: resolvePurchaseOrderItemDescription(item.raw as Record<string, unknown>) || resolvePurchaseOrderItemDescription(itemRow),
        itemId: item.itemId,
        lineTotal: item.requestedLineTotal ?? (item.quantityOrdered * resolvedUnitCost),
        quantityOrdered: item.quantityOrdered,
        requisitionItemId: item.requisitionItemId,
        taxRate: item.taxRate,
        unitCost: resolvedUnitCost,
        unitOfMeasureId: resolvedUnitId,
      };
    });

    // Generate PO number
    const { count: poCount } = await service
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const poNumber = `PO-${String((poCount ?? 0) + 1).padStart(5, '0')}`;
    const taxAmount = body.taxAmount ?? 0;
    const discountAmount = body.discountAmount ?? 0;
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
    const total = subtotal + taxAmount - discountAmount;

    let orderPayload: Record<string, unknown> = {
      po_number: poNumber,
      supplier_id: supplierId,
      requisition_id: requisitionId || null,
      order_date: body.orderDate ?? new Date().toISOString(),
      expected_delivery_date: body.expectedDeliveryDate ?? null,
      currency,
      delivery_address: deliveryAddress,
      notes: body.notes ?? null,
      supplier_quote: supplierQuote,
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

    if (orderInsert.error) {
      logPurchaseOrderFailure('purchase_orders.insert', {
        firstLine: resolvedItems[0] ?? null,
        header: {
          order_date: orderPayload.order_date,
          requisition_id: orderPayload.requisition_id,
          supplier_id: orderPayload.supplier_id,
          subtotal: orderPayload.subtotal,
          total: orderPayload.total,
        },
        lineCount: resolvedItems.length,
        message: orderInsert.error.message,
      });
      return poCreateFailure(500, {
        lineCount: resolvedItems.length,
        operation: 'insert_purchase_orders',
      });
    }
    const order = orderInsert.data;

    const orderId = (order as Record<string, unknown>).id as string;
    createdOrderId = orderId;

    let itemPayload: Record<string, unknown>[] = resolvedItems.map((item) => ({
      po_id: orderId,
      purchase_order_id: orderId,
      requisition_item_id: item.requisitionItemId || null,
      item_id: item.itemId,
      unit_of_measure_id: item.unitOfMeasureId || null,
      description: item.description || null,
      quantity: item.quantityOrdered,
      quantity_ordered: item.quantityOrdered,
      received_qty: 0,
      quantity_received: 0,
      unit_price: item.unitCost,
      unit_cost: item.unitCost,
      tax_rate: item.taxRate,
      tax_amount: item.lineTotal * (item.taxRate / 100),
      total_ex_vat: item.lineTotal,
      line_total: item.lineTotal,
      total_cost: item.lineTotal,
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

    if (itemsErr) {
      await rollbackCreatedPurchaseOrder(service, orderId);
      logPurchaseOrderFailure('purchase_order_items.insert', {
        firstLine: itemPayload[0] ?? null,
        header: {
          purchase_order_id: orderId,
          requisition_id: requisitionId || null,
          supplier_id: supplierId,
        },
        lineCount: itemPayload.length,
        message: itemsErr.message,
      });
      return poCreateFailure(500, {
        lineCount: itemPayload.length,
        operation: 'insert_purchase_order_items',
      });
    }

    // Update requisition status if linked
    if (requisitionId && requisitionRemainingAfterCreate.every((line) => line.remainingAfterCreate <= 0)) {
      await service
        .from('purchase_requisitions')
        .update({ status: 'PO_CREATED' })
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
        items: resolvedItems.map((item, index) => ({
          description: item.description || '',
          item_id: item.itemId,
          itemId: item.itemId,
          quantity: item.quantityOrdered,
          requisition_item_id: item.requisitionItemId || null,
          requisitionItemId: item.requisitionItemId || null,
          rowId: itemPayload[index]?.requisition_item_id ?? item.requisitionItemId ?? `${index}`,
          tax_rate: item.taxRate,
          taxRate: item.taxRate,
          line_total: item.lineTotal,
          lineTotal: item.lineTotal,
          unit_of_measure_id: item.unitOfMeasureId || null,
          unitOfMeasureId: item.unitOfMeasureId || null,
          unit_price: item.unitCost,
          unitPrice: item.unitCost,
        })),
      },
    }, { status: 201 });
  } catch (err) {
    if (createdOrderId) {
      try {
        await rollbackCreatedPurchaseOrder(service, createdOrderId);
      } catch (rollbackError) {
        console.error('Failed to roll back purchase order creation.', {
          message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          orderId: createdOrderId,
        });
      }
    }

    return serverError((err as Error).message);
  }
}
