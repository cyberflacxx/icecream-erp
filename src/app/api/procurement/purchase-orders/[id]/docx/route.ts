import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createBusinessDocx } from '@/lib/docx';
import { formatCurrency } from '@/lib/money';
import { getCompanyProfile } from '@/lib/settings-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function formatDate(value: unknown, fallback = '-') {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

function sanitizeFileToken(value: string, fallback: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized || fallback;
}

function isMissingColumnError(error: { message?: string } | null | undefined, table: string, columnName: string) {
  return (error?.message ?? '').includes(`column ${table}.${columnName} does not exist`);
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient().schema('icecream_erp');

  try {
    const [company, orderPrimary] = await Promise.all([
      getCompanyProfile().catch(() => null),
      service
        .from('purchase_orders')
        .select(
          `id, po_number, order_date, expected_delivery_date, notes, subtotal, tax_amount, discount_amount, total,
           supplier_quote, currency, delivery_address, payment_terms, delivery_terms, prepared_for, approval_notes, approved_at, approved_by,
           suppliers(name, email, phone, address)`,
        )
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .maybeSingle(),
    ]);

    const orderRes =
      orderPrimary.error &&
      ['supplier_quote', 'currency', 'delivery_address', 'payment_terms', 'delivery_terms', 'prepared_for'].some((column) =>
        isMissingColumnError(orderPrimary.error, 'purchase_orders', column),
      )
        ? await service
            .from('purchase_orders')
            .select(
              `id, po_number, order_date, expected_delivery_date, notes, subtotal, tax_amount, discount_amount, total,
               approval_notes, approved_at, approved_by, suppliers(name, email, phone, address)`,
            )
            .is('deleted_at', null)
            .eq('organization_id', ctx.organizationId)
            .eq('id', id)
            .maybeSingle()
        : orderPrimary;

    if (orderRes.error) return serverError(orderRes.error.message);
    if (!isRow(orderRes.data)) return notFound('Purchase order not found.');
    const order: Record<string, unknown> = { ...orderRes.data };

    const itemsPrimary = await service
      .from('purchase_order_items')
      .select('quantity_ordered, unit_cost, unit_price, tax_rate, tax_amount, total_cost, total_ex_vat, description, unit_of_measure_id, items(code, name, description, unit_of_measure_id)')
      .eq('purchase_order_id', id)
      .order('created_at', { ascending: true });
    const itemsRes =
      itemsPrimary.error &&
      ['unit_price', 'tax_rate', 'tax_amount', 'total_ex_vat', 'description'].some((column) =>
        isMissingColumnError(itemsPrimary.error, 'purchase_order_items', column),
      )
        ? await service
            .from('purchase_order_items')
            .select('quantity_ordered, unit_cost, total_cost, unit_of_measure_id, items(code, name, description, unit_of_measure_id)')
            .eq('purchase_order_id', id)
            .order('created_at', { ascending: true })
        : itemsPrimary;

    if (itemsRes.error) return serverError(itemsRes.error.message);

    const itemRowsSource: Array<Record<string, unknown>> = (Array.isArray(itemsRes.data)
      ? Array.from(itemsRes.data, (value): unknown => value)
      : []
    ).filter(isRow);
    const unitIds = [...new Set(itemRowsSource.map((item) => {
      const productValue = Array.isArray(item.items) ? item.items[0] : item.items;
      const product = isRow(productValue) ? productValue : null;
      return String(item.unit_of_measure_id ?? product?.unit_of_measure_id ?? '');
    }).filter(Boolean))];

    const unitsRes = unitIds.length
      ? await service.from('units_of_measure').select('id, abbreviation').in('id', unitIds)
      : { data: [], error: null };
    if (unitsRes.error) return serverError(unitsRes.error.message);

    const supplierValue = order.suppliers;
    const supplierCandidate = Array.isArray(supplierValue) ? supplierValue[0] : supplierValue;
    const supplier = isRow(supplierCandidate) ? supplierCandidate : null;
    const unitsById = new Map((unitsRes.data ?? []).map((unit) => [String(unit.id), unit]));
    const companyName = company?.name?.trim() || 'Absolute Quality Icecream';
    const companyCurrency = String(order.currency ?? company?.currency ?? 'USD');

    const rows = itemRowsSource.map((item) => {
      const productValue = Array.isArray(item.items) ? item.items[0] : item.items;
      const product = isRow(productValue) ? productValue : null;
      const unitId = String(item.unit_of_measure_id ?? product?.unit_of_measure_id ?? '');
      const unit = unitsById.get(unitId);
      const quantity = Number(item.quantity_ordered ?? 0);
      const unitPrice = Number(item.unit_price ?? item.unit_cost ?? 0);
      const total = Number(item.total_ex_vat ?? item.total_cost ?? quantity * unitPrice);
      return {
        code: String(product?.code ?? '-'),
        description: String(item.description ?? product?.description ?? product?.name ?? '-'),
        qty: quantity,
        uom: String(unit?.abbreviation ?? '-'),
        unitPrice: formatCurrency(unitPrice),
        tax: `${Number(item.tax_rate ?? 0).toFixed(2)}%`,
        total: formatCurrency(total),
      };
    });

    const document = Buffer.from(createBusinessDocx({
      companyName,
      title: 'PURCHASE ORDER',
      subtitle: String(order.po_number ?? id),
      metadata: [
        { label: 'PO Number', value: String(order.po_number ?? '-') },
        { label: 'Order Date', value: formatDate(order.order_date) },
        { label: 'Expected Delivery', value: formatDate(order.expected_delivery_date) },
        { label: 'Currency', value: companyCurrency },
      ],
      sections: [
        {
          title: 'Supplier',
          lines: [
            String(supplier?.name ?? '-'),
            String(supplier?.address ?? '-'),
            String(supplier?.phone ?? '-'),
            String(supplier?.email ?? '-'),
          ],
        },
        {
          title: 'Buyer / Delivery',
          lines: [
            companyName,
            String(order.delivery_address ?? company?.address ?? '-'),
            `Prepared for: ${String(order.prepared_for ?? order.notes ?? 'Procurement / Operations')}`,
          ],
        },
        {
          title: 'Payment and Delivery Terms',
          lines: [
            `Payment terms: ${String(order.payment_terms ?? 'As agreed with supplier')}`,
            `Delivery terms: ${String(order.delivery_terms ?? 'Standard supplier delivery')}`,
            `Supplier quote / proforma: ${String(order.supplier_quote ?? '-')}`,
          ],
        },
      ],
      table: {
        title: 'Line Items',
        columns: [
          { key: 'code', header: 'Code' },
          { key: 'description', header: 'Description' },
          { key: 'qty', header: 'Qty' },
          { key: 'uom', header: 'UOM' },
          { key: 'unitPrice', header: 'Unit Price' },
          { key: 'tax', header: 'Tax' },
          { key: 'total', header: 'Total Ex VAT' },
        ],
        rows,
      },
      totals: [
        { label: 'Subtotal', value: formatCurrency(Number(order.subtotal ?? 0)) },
        { label: 'Discount', value: formatCurrency(Number(order.discount_amount ?? 0)) },
        { label: 'Tax', value: formatCurrency(Number(order.tax_amount ?? 0)) },
        { label: 'TOTAL', value: formatCurrency(Number(order.total ?? 0)) },
      ],
      footerText: `Generated by Absolute Ice Cream ERP | Approved: ${String(order.approved_by ?? 'Pending')} | ${formatDate(order.approved_at)}`,
    }));

    const fileName = `purchase-order-${sanitizeFileToken(String(order.po_number ?? id), 'purchase-order')}.docx`;
    return new NextResponse(document, {
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Purchase order DOCX generation failed.', {
      message: error instanceof Error ? error.message : String(error),
      purchaseOrderId: id,
    });
    return NextResponse.json({
      success: false,
      message: 'Purchase order DOCX could not be generated.',
      code: 'PO_DOCX_FAILED',
    }, { status: 500 });
  }
}
