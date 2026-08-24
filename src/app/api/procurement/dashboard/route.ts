import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildInvoiceAgeingRows, buildSupplierShortageRows } from '@/lib/procurement';
import { normalizePurchaseOrderStatus } from '@/lib/procurement-purchase-orders';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.dashboard.view', 'procurement.read', 'reports.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();

  const [
    requisitions,
    approvals,
    orders,
    returns,
    invoices,
    payments,
  ] = await Promise.all([
    service.from('purchase_requisitions').select('id, status, approval_status', { count: 'exact' }).eq('organization_id', ctx.organizationId),
    service.from('purchase_requisitions').select('id, status, approval_status', { count: 'exact' }).eq('organization_id', ctx.organizationId),
    service.from('purchase_orders').select('id, status, total_amount, expected_date, supplier_id', { count: 'exact' }).eq('organization_id', ctx.organizationId),
    service.from('supplier_returns').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).in('status', ['draft', 'pending_qc']),
    service.from('supplier_invoices').select('id, invoice_number, invoice_date, due_date, invoice_total, status, supplier_id').eq('organization_id', ctx.organizationId),
    service.from('supplier_payments').select('supplier_invoice_id, amount_paid').eq('organization_id', ctx.organizationId),
  ]);

  if (requisitions.error) return serverError(requisitions.error.message);
  if (approvals.error) return serverError(approvals.error.message);
  if (orders.error) return serverError(orders.error.message);
  if (returns.error) return serverError(returns.error.message);
  if (invoices.error) return serverError(invoices.error.message);
  if (payments.error) return serverError(payments.error.message);

  const orderIds = (orders.data ?? []).map((row) => String(row.id));
  const supplierIds = [...new Set((orders.data ?? []).map((row) => String(row.supplier_id ?? '')).filter(Boolean))];
  const orderItemSelect = 'po_id, purchase_order_id, quantity, quantity_ordered, received_qty, quantity_received, item_id';
  const [orderItemsByPurchaseOrderId, orderItemsByLegacyPoId, suppliersResult] = await Promise.all([
    orderIds.length ? service.from('purchase_order_items').select(orderItemSelect).in('purchase_order_id', orderIds) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? service.from('purchase_order_items').select(orderItemSelect).in('po_id', orderIds) : Promise.resolve({ data: [], error: null }),
    supplierIds.length ? service.from('suppliers').select('id, name').in('id', supplierIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (orderItemsByPurchaseOrderId.error) return serverError(orderItemsByPurchaseOrderId.error.message);
  if (orderItemsByLegacyPoId.error) return serverError(orderItemsByLegacyPoId.error.message);
  if (suppliersResult.error) return serverError(suppliersResult.error.message);

  const orderItemRowsByKey = new Map<string, Record<string, unknown>>();
  for (const row of [...(orderItemsByPurchaseOrderId.data ?? []), ...(orderItemsByLegacyPoId.data ?? [])]) {
    const key = [
      row.purchase_order_id ?? '',
      row.po_id ?? '',
      row.item_id ?? '',
      row.quantity_ordered ?? row.quantity ?? '',
      row.quantity_received ?? row.received_qty ?? '',
    ].join(':');
    orderItemRowsByKey.set(key, row as Record<string, unknown>);
  }
  const orderItemRows = [...orderItemRowsByKey.values()];
  const itemIds = [...new Set(orderItemRows.map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const itemsResult = itemIds.length ? await service.from('items').select('id, name').in('id', itemIds) : { data: [], error: null };
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const suppliersById = new Map((suppliersResult.data ?? []).map((row) => [String(row.id), row]));
  const itemsById = new Map((itemsResult.data ?? []).map((row) => [String(row.id), row]));
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
  for (const item of orderItemRows) {
    const key = String(item.purchase_order_id ?? item.po_id);
    itemsByOrder.set(key, [...(itemsByOrder.get(key) ?? []), {
      quantity_ordered: item.quantity_ordered ?? item.quantity,
      quantity_received: item.quantity_received ?? item.received_qty,
      items: itemsById.get(String(item.item_id)) ?? null,
    }]);
  }
  const purchaseOrders = (orders.data ?? []).map((row) => ({
    ...row,
    total: row.total_amount,
    expected_delivery_date: row.expected_date,
    suppliers: suppliersById.get(String(row.supplier_id)) ?? null,
    purchase_order_items: itemsByOrder.get(String(row.id)) ?? [],
  })) as Array<Record<string, unknown>>;
  const shortages = buildSupplierShortageRows(purchaseOrders);
  const paymentsByInvoiceId = new Map<string, number>();
  for (const payment of payments.data ?? []) {
    const key = String(payment.supplier_invoice_id);
    paymentsByInvoiceId.set(key, (paymentsByInvoiceId.get(key) ?? 0) + Number(payment.amount_paid ?? 0));
  }
  const ageing = buildInvoiceAgeingRows((invoices.data ?? []) as Array<Record<string, unknown>>, paymentsByInvoiceId);

  return NextResponse.json({
    openPurchaseRequisitions: (requisitions.data ?? []).filter((row) => ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'].includes(normalizePurchaseOrderStatus(row.approval_status ?? row.status))).length,
    pendingPurchaseApprovals: (approvals.data ?? []).filter((row) => ['SUBMITTED', 'PENDING_APPROVAL'].includes(normalizePurchaseOrderStatus(row.approval_status ?? row.status))).length,
    openPurchaseOrders: (orders.data ?? []).filter((row) => ['DRAFT', 'APPROVED', 'SENT', 'SENT_TO_SUPPLIER'].includes(normalizePurchaseOrderStatus(row.status))).length,
    partiallyReceivedPurchaseOrders: (orders.data ?? []).filter((row) => ['PARTIAL_RECEIVED', 'PARTIALLY_RECEIVED'].includes(normalizePurchaseOrderStatus(row.status))).length,
    supplierShortages: shortages.length,
    pendingSupplierReturns: returns.count ?? 0,
    supplierInvoicesDue: ageing.filter((row) => row.balance > 0).length,
    topSuppliersByValue: aggregateSupplierValue(purchaseOrders),
    lateDeliveries: shortages.filter((row) => row.ageInDays > 0).length,
  });
}

function aggregateSupplierValue(rows: Array<Record<string, unknown>>) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const name = String((supplier as Record<string, unknown> | null)?.name ?? 'Unknown supplier');
    totals.set(name, (totals.get(name) ?? 0) + Number(row.total ?? 0));
  }

  return Array.from(totals.entries())
    .map(([supplierName, totalValue]) => ({ supplierName, totalValue }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
}
