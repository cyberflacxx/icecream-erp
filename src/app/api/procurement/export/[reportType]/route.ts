import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { toCsv } from '@/lib/inventory';
import { buildCostVarianceRows, buildInvoiceAgeingRows, buildSupplierShortageRows } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportType: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'procurement.read', 'finance.read')) return forbidden();

  const { reportType } = await params;
  const service = createServiceRoleClient();

  let rows: Array<Record<string, string | number | null>> = [];

  if (reportType === 'purchase-orders') {
    const { data, error } = await service.from('purchase_orders').select('po_number, order_date, expected_delivery_date, total, status, suppliers(name)').eq('organization_id', ctx.organizationId).is('deleted_at', null);
    if (error) return serverError(error.message);
    rows = (data ?? []).map((row) => {
      const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
      return {
        expectedDeliveryDate: row.expected_delivery_date ? String(row.expected_delivery_date) : null,
        orderDate: row.order_date ? String(row.order_date) : null,
        poNumber: String(row.po_number ?? ''),
        status: String(row.status ?? ''),
        supplierName: String((supplier as Record<string, unknown> | null)?.name ?? 'Unknown supplier'),
        total: Number(row.total ?? 0),
      };
    });
  } else if (reportType === 'supplier-shortages') {
    const { data, error } = await service.from('purchase_orders').select('po_number, expected_delivery_date, suppliers(name), purchase_order_items(quantity_ordered, quantity_received, items(name))').eq('organization_id', ctx.organizationId).is('deleted_at', null);
    if (error) return serverError(error.message);
    rows = buildSupplierShortageRows((data ?? []) as Array<Record<string, unknown>>);
  } else if (reportType === 'invoice-ageing') {
    const [invoices, payments] = await Promise.all([
      service.from('supplier_invoices').select('id, invoice_number, invoice_date, due_date, invoice_total, status, suppliers(name)').eq('organization_id', ctx.organizationId).is('deleted_at', null),
      service.from('supplier_payments').select('supplier_invoice_id, amount_paid').eq('organization_id', ctx.organizationId).is('deleted_at', null),
    ]);
    if (invoices.error) return serverError(invoices.error.message);
    if (payments.error) return serverError(payments.error.message);
    const paymentsByInvoiceId = new Map<string, number>();
    for (const payment of payments.data ?? []) paymentsByInvoiceId.set(String(payment.supplier_invoice_id), (paymentsByInvoiceId.get(String(payment.supplier_invoice_id)) ?? 0) + Number(payment.amount_paid ?? 0));
    rows = buildInvoiceAgeingRows((invoices.data ?? []) as Array<Record<string, unknown>>, paymentsByInvoiceId);
  } else if (reportType === 'cost-variance') {
    const { data, error } = await service.from('supplier_invoices').select('invoice_number, suppliers(name), purchase_orders(po_number), supplier_invoice_items(quantity_invoiced, unit_cost, po_unit_cost, unit_cost_reference, items(name))').eq('organization_id', ctx.organizationId).is('deleted_at', null);
    if (error) return serverError(error.message);
    rows = buildCostVarianceRows((data ?? []) as Array<Record<string, unknown>>);
  } else {
    return badRequest('Unsupported procurement export report.');
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Disposition': `attachment; filename="${reportType}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
