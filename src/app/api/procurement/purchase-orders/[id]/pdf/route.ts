import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createPlainTextPdf } from '@/lib/pdf';
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

function formatPdfRow(columns: Array<[string, number]>) {
  return columns
    .map(([value, width]) => String(value ?? '').slice(0, width).padEnd(width, ' '))
    .join(' ');
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
    const [company, orderRes] = await Promise.all([
      getCompanyProfile().catch(() => null),
      service
        .from('purchase_orders')
        .select(
          `id, po_number, requisition_id, order_date, expected_delivery_date, notes, subtotal, tax_amount, discount_amount, total,
           suppliers(name, email, phone, address)`,
        )
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .maybeSingle(),
    ]);

    if (orderRes.error) return serverError(orderRes.error.message);
    if (!orderRes.data) return notFound('Purchase order not found.');

    const itemsRes = await service
      .from('purchase_order_items')
      .select('quantity_ordered, unit_cost, total_cost, unit_of_measure_id, items(code, name, unit_of_measure_id)')
      .eq('purchase_order_id', id)
      .order('created_at', { ascending: true });
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
    const itemLines = (itemsRes.data ?? []).map((item, index) => {
      const product = Array.isArray(item.items) ? item.items[0] : item.items;
      const resolvedUnitId = String(
        item.unit_of_measure_id ?? (product as Record<string, unknown> | null)?.unit_of_measure_id ?? '',
      );
      const unit = unitsById.get(resolvedUnitId);

      return formatPdfRow([
        [String(index + 1), 3],
        [String(product?.code ?? ''), 16],
        [String(product?.name ?? ''), 26],
        [String(Number(item.quantity_ordered ?? 0)), 8],
        [String(unit?.abbreviation ?? ''), 6],
        [currencyFormatter.format(Number(item.unit_cost ?? 0)), 13],
        [currencyFormatter.format(Number(item.total_cost ?? 0)), 13],
      ]);
    });

    const pdfLines = [
      companyName,
      companyAddress || '',
      companyPhone || '',
      companyEmail || '',
      companyTaxNumber ? `Tax No: ${companyTaxNumber}` : '',
      '',
      `PO Number: ${String(orderRes.data.po_number ?? '')}`,
      `Requisition Ref: ${String(orderRes.data.requisition_id ?? '-')}`,
      `Order Date: ${formatDate(orderRes.data.order_date)}`,
      `Expected Delivery: ${formatDate(orderRes.data.expected_delivery_date)}`,
      `Currency: ${companyCurrency}`,
      '',
      `Supplier: ${String(supplier?.name ?? '')}`,
      `Address: ${String(supplier?.address ?? '-')}`,
      `Phone: ${String(supplier?.phone ?? '-')}`,
      `Email: ${String(supplier?.email ?? '-')}`,
      '',
      'Items',
      formatPdfRow([
        ['#', 3],
        ['Code', 16],
        ['Description', 26],
        ['Qty', 8],
        ['UOM', 6],
        ['Unit Price', 13],
        ['Line Total', 13],
      ]),
      '-'.repeat(91),
      ...itemLines,
      '',
      `Subtotal: ${currencyFormatter.format(Number(orderRes.data.subtotal ?? 0))}`,
      `Tax: ${currencyFormatter.format(Number(orderRes.data.tax_amount ?? 0))}`,
      `Discount: ${currencyFormatter.format(Number(orderRes.data.discount_amount ?? 0))}`,
      `Total: ${currencyFormatter.format(Number(orderRes.data.total ?? 0))}`,
      '',
      'Notes',
      String(orderRes.data.notes ?? 'No additional delivery or supplier instructions were provided.'),
      '',
      'Please reference the purchase order number on all delivery notes, invoices, and correspondence.',
    ].filter((line, index, collection) => line !== '' || collection[index - 1] !== '');

    const pdf = Buffer.from(createPlainTextPdf(pdfLines, {
      maxColumns: 92,
      title: `Purchase Order ${String(orderRes.data.po_number ?? '')}`,
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
