import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildInvoiceAgeingRows, buildSupplierShortageRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'reports.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();

  const [
    requisitions,
    approvals,
    orders,
    returns,
    invoices,
    payments,
  ] = await Promise.all([
    service.from('purchase_requisitions').select('id, status', { count: 'exact' }).eq('organization_id', ctx.organizationId).is('deleted_at', null),
    service.from('purchase_requisitions').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).eq('status', 'submitted').is('deleted_at', null),
    service.from('purchase_orders').select('id, status, total, expected_delivery_date, suppliers(name), purchase_order_items(quantity_ordered, quantity_received, items(name))', { count: 'exact' }).eq('organization_id', ctx.organizationId).is('deleted_at', null),
    service.from('supplier_returns').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).in('status', ['draft', 'pending_qc']).is('deleted_at', null),
    service.from('supplier_invoices').select('id, invoice_number, invoice_date, due_date, invoice_total, status, suppliers(name)').eq('organization_id', ctx.organizationId).is('deleted_at', null),
    service.from('supplier_payments').select('supplier_invoice_id, amount_paid').eq('organization_id', ctx.organizationId).is('deleted_at', null),
  ]);

  if (requisitions.error) return serverError(requisitions.error.message);
  if (approvals.error) return serverError(approvals.error.message);
  if (orders.error) return serverError(orders.error.message);
  if (returns.error) return serverError(returns.error.message);
  if (invoices.error) return serverError(invoices.error.message);
  if (payments.error) return serverError(payments.error.message);

  const shortages = buildSupplierShortageRows((orders.data ?? []) as Array<Record<string, unknown>>);
  const paymentsByInvoiceId = new Map<string, number>();
  for (const payment of payments.data ?? []) {
    const key = String(payment.supplier_invoice_id);
    paymentsByInvoiceId.set(key, (paymentsByInvoiceId.get(key) ?? 0) + Number(payment.amount_paid ?? 0));
  }
  const ageing = buildInvoiceAgeingRows((invoices.data ?? []) as Array<Record<string, unknown>>, paymentsByInvoiceId);

  return NextResponse.json({
    openPurchaseRequisitions: (requisitions.data ?? []).filter((row) => ['draft', 'submitted'].includes(String(row.status))).length,
    pendingPurchaseApprovals: approvals.count ?? 0,
    openPurchaseOrders: (orders.data ?? []).filter((row) => ['draft', 'approved', 'sent_to_supplier'].includes(String(row.status))).length,
    partiallyReceivedPurchaseOrders: (orders.data ?? []).filter((row) => String(row.status) === 'partial_received').length,
    supplierShortages: shortages.length,
    pendingSupplierReturns: returns.count ?? 0,
    supplierInvoicesDue: ageing.filter((row) => row.balance > 0).length,
    topSuppliersByValue: aggregateSupplierValue((orders.data ?? []) as Array<Record<string, unknown>>),
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
