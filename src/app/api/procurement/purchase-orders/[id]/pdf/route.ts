import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createPurchaseOrderPdfDocument } from '@/lib/pdf';
import { getCompanyProfile } from '@/lib/settings-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(value: unknown, fallback = '-') {
  if (!value) return fallback;
  return new Date(String(value)).toLocaleDateString();
}

function sanitizeFileToken(value: string, fallback: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized || fallback;
}

function isMissingColumnError(error: { message?: string } | null | undefined, table: string, columnName: string) {
  return (error?.message ?? '').includes(`column ${table}.${columnName} does not exist`);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const [company, orderPrimary] = await Promise.all([
      getCompanyProfile().catch(() => null),
      service
        .from('purchase_orders')
        .select(
          `id, po_number, requisition_id, order_date, expected_delivery_date, notes, subtotal, tax_amount, discount_amount, total,
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
              `id, po_number, requisition_id, order_date, expected_delivery_date, notes, subtotal, tax_amount, discount_amount, total,
               approval_notes, approved_at, approved_by,
               suppliers(name, email, phone, address)`,
            )
            .is('deleted_at', null)
            .eq('organization_id', ctx.organizationId)
            .eq('id', id)
            .maybeSingle()
        : orderPrimary;

    if (orderRes.error) return serverError(orderRes.error.message);
    if (!orderRes.data) return notFound('Purchase order not found.');

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
      ? await service.from('units_of_measure').select('id, abbreviation').in('id', unitIds)
      : { data: [], error: null };
    if (unitsRes.error) return serverError(unitsRes.error.message);

    const companyName = company?.name?.trim() || 'Absolute Ice Cream';
    const companyAddress = company?.address?.trim() || '';
    const companyPhone = company?.phone?.trim() || '';
    const companyEmail = company?.email?.trim() || '';
    const companyTaxNumber = company?.tax_number?.trim() || '';
    const companyCurrency = company?.currency?.trim() || 'USD';

    const supplier = Array.isArray(orderRes.data.suppliers) ? orderRes.data.suppliers[0] : orderRes.data.suppliers;
    const unitsById = new Map((unitsRes.data ?? []).map((unit) => [String(unit.id), unit]));
    const itemRows = (itemsRes.data ?? []).map((item) => {
      const product = Array.isArray(item.items) ? item.items[0] : item.items;
      const resolvedUnitId = String(
        item.unit_of_measure_id ?? (product as Record<string, unknown> | null)?.unit_of_measure_id ?? '',
      );
      const unit = unitsById.get(resolvedUnitId);

      return {
        code: String(product?.code ?? ''),
        description: String(item.description ?? product?.description ?? product?.name ?? ''),
        line_total: Number(item.total_ex_vat ?? item.total_cost ?? Number(item.quantity_ordered ?? 0) * Number(item.unit_price ?? item.unit_cost ?? 0)),
        qty: Number(item.quantity_ordered ?? 0),
        tax_rate: Number(item.tax_rate ?? 0),
        unit_price: Number(item.unit_price ?? item.unit_cost ?? 0),
        uom: String(unit?.abbreviation ?? ''),
      };
    });

    const pdf = Buffer.from(createPurchaseOrderPdfDocument({
      authorization: {
        approvedBy: String(orderRes.data.approved_by ?? '____________________'),
        date: formatDate(orderRes.data.approved_at ?? orderRes.data.order_date),
      },
      buyer: {
        address: String(orderRes.data.delivery_address ?? companyAddress ?? '-'),
        companyName,
        preparedFor: String(orderRes.data.prepared_for ?? orderRes.data.notes ?? 'Procurement / Operations'),
      },
      currency: String(orderRes.data.currency ?? companyCurrency ?? 'USD'),
      deliveryTerms: [
        `Payment method: ${String(orderRes.data.payment_terms ?? 'As agreed with supplier')}`,
        `Delivery address: ${String(orderRes.data.delivery_address ?? companyAddress ?? '-')}`,
        `Delivery terms: ${String(
          orderRes.data.delivery_terms ??
            (orderRes.data.expected_delivery_date
              ? `Expected by ${formatDate(orderRes.data.expected_delivery_date)}`
              : 'Standard supplier delivery'),
        )}`,
        `Supplier quote / proforma: ${String(orderRes.data.supplier_quote ?? '-')}`,
      ],
      footerText: `Generated Purchase Order | ${companyName}`,
      items: itemRows.map((item) => ({
        code: item.code,
        description: item.description,
        qty: String(item.qty),
        tax: `${item.tax_rate.toFixed(2)}%`,
        totalExVat: currencyFormatter.format(item.line_total),
        unitPrice: currencyFormatter.format(item.unit_price),
        uom: item.uom || '-',
      })),
      metadata: [
        { label: 'PO No', value: String(orderRes.data.po_number ?? '-') },
        { label: 'PO Date', value: formatDate(orderRes.data.order_date) },
        { label: 'Supplier Quote', value: String(orderRes.data.supplier_quote ?? '-') },
        { label: 'Currency', value: String(orderRes.data.currency ?? companyCurrency ?? 'USD') },
      ],
      supplier: {
        address: String(supplier?.address ?? '-'),
        email: String(supplier?.email ?? '-'),
        name: String(supplier?.name ?? '-'),
        phone: String(supplier?.phone ?? '-'),
      },
      title: 'PURCHASE ORDER',
      totals: [
        { label: 'Total Net Price', value: currencyFormatter.format(Number(orderRes.data.subtotal ?? 0)) },
        { label: 'Discount', value: currencyFormatter.format(Number(orderRes.data.discount_amount ?? 0)) },
        { label: 'Tax', value: currencyFormatter.format(Number(orderRes.data.tax_amount ?? 0)) },
        { label: 'TOTAL', value: currencyFormatter.format(Number(orderRes.data.total ?? 0)) },
      ],
    }));
    const fileName = `purchase-order-${sanitizeFileToken(String(orderRes.data.po_number ?? id), 'purchase-order')}.pdf`;

    return new NextResponse(pdf, {
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to render purchase order document.');
  }
}
