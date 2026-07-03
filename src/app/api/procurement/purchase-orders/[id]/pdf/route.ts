import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { getCompanyProfile } from '@/lib/settings-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(value: unknown, fallback = '-') {
  if (!value) return fallback;
  return new Date(String(value)).toLocaleDateString();
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  request: NextRequest,
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
    const rows = (itemsRes.data ?? [])
      .map((item, index) => {
        const product = Array.isArray(item.items) ? item.items[0] : item.items;
        const resolvedUnitId = String(
          item.unit_of_measure_id ?? (product as Record<string, unknown> | null)?.unit_of_measure_id ?? '',
        );
        const unit = unitsById.get(resolvedUnitId);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(product?.code ?? '')}</td>
            <td>${escapeHtml(product?.name ?? '')}</td>
            <td>${Number(item.quantity_ordered ?? 0)}</td>
            <td>${escapeHtml(unit?.abbreviation ?? '')}</td>
            <td>${currencyFormatter.format(Number(item.unit_cost ?? 0))}</td>
            <td>${currencyFormatter.format(Number(item.total_cost ?? 0))}</td>
          </tr>
        `;
      })
      .join('');

    const origin = request.nextUrl.origin;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(orderRes.data.po_number ?? 'Purchase Order')}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: Arial, sans-serif; margin: 28px; color: #2c2218; background: #fffaf4; }
      .sheet { background: #ffffff; border: 1px solid #ecd9c5; border-radius: 24px; overflow: hidden; }
      .hero { display: flex; justify-content: space-between; gap: 24px; padding: 28px; background: linear-gradient(135deg, #fff5e7, #ffffff); border-bottom: 1px solid #ecd9c5; }
      .brand { max-width: 60%; }
      .brand img { width: 132px; height: auto; }
      .eyebrow { letter-spacing: 0.24em; text-transform: uppercase; font-size: 11px; color: #8d7560; margin-top: 8px; }
      .brand h1 { margin: 10px 0 6px; font-size: 30px; }
      .brand p { margin: 2px 0; font-size: 13px; color: #5f4a38; }
      .meta-card { min-width: 260px; border: 1px solid #ead7c2; border-radius: 20px; background: rgba(255,255,255,0.92); padding: 18px 20px; }
      .meta-card table { width: 100%; border-collapse: collapse; }
      .meta-card td { padding: 6px 0; font-size: 13px; vertical-align: top; }
      .meta-card td:first-child { color: #8d7560; width: 48%; }
      .section { padding: 24px 28px; }
      .section-grid { display: grid; gap: 18px; grid-template-columns: 1.2fr 0.8fr; }
      .panel { border: 1px solid #ead7c2; border-radius: 20px; background: #fffdfa; padding: 18px 20px; }
      .panel h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: #8d7560; }
      .panel p { margin: 4px 0; font-size: 14px; }
      table.items { width: 100%; border-collapse: collapse; margin-top: 20px; }
      table.items th, table.items td { border: 1px solid #ead7c2; padding: 10px 12px; text-align: left; font-size: 13px; }
      table.items th { background: #fff1df; color: #6d553f; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; }
      .totals-wrap { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; margin-top: 20px; }
      .notes { border: 1px solid #ead7c2; border-radius: 20px; background: #fffdfa; padding: 18px 20px; min-height: 120px; }
      .notes h3 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: #8d7560; }
      .notes p { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
      .totals { border: 1px solid #ead7c2; border-radius: 20px; background: #fff7ef; padding: 18px 20px; }
      .totals table { width: 100%; border-collapse: collapse; }
      .totals td { padding: 7px 0; font-size: 14px; }
      .totals tr:last-child td { border-top: 1px solid #d9c1ab; padding-top: 12px; font-size: 16px; font-weight: bold; }
      .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 0 28px 28px; }
      .signature { border-top: 1px dashed #b99a7c; padding-top: 10px; margin-top: 48px; font-size: 13px; color: #6d553f; }
      .terms { font-size: 12px; color: #6d553f; line-height: 1.6; }
      @media print {
        body { margin: 0; background: white; }
        .sheet { border: 0; border-radius: 0; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <div class="brand">
          <img src="${origin}/branding/logo.png" alt="Company logo" />
          <div class="eyebrow">Supplier Purchase Order</div>
          <h1>${escapeHtml(companyName)}</h1>
          ${companyAddress ? `<p>${escapeHtml(companyAddress)}</p>` : ''}
          ${companyPhone ? `<p>${escapeHtml(companyPhone)}</p>` : ''}
          ${companyEmail ? `<p>${escapeHtml(companyEmail)}</p>` : ''}
          ${companyTaxNumber ? `<p>Tax No: ${escapeHtml(companyTaxNumber)}</p>` : ''}
        </div>
        <div class="meta-card">
          <table>
            <tr><td>PO Number</td><td>${escapeHtml(orderRes.data.po_number ?? '')}</td></tr>
            <tr><td>Requisition Ref</td><td>${escapeHtml(orderRes.data.requisition_id ?? '-')}</td></tr>
            <tr><td>Order Date</td><td>${escapeHtml(formatDate(orderRes.data.order_date))}</td></tr>
            <tr><td>Expected Delivery</td><td>${escapeHtml(formatDate(orderRes.data.expected_delivery_date))}</td></tr>
            <tr><td>Currency</td><td>${escapeHtml(companyCurrency)}</td></tr>
          </table>
        </div>
      </div>

      <div class="section">
        <div class="section-grid">
          <div class="panel">
            <h2>Supplier</h2>
            <p><strong>${escapeHtml(supplier?.name ?? '')}</strong></p>
            <p>${escapeHtml(supplier?.address ?? '-')}</p>
            <p>${escapeHtml(supplier?.phone ?? '-')}</p>
            <p>${escapeHtml(supplier?.email ?? '-')}</p>
          </div>
          <div class="panel">
            <h2>Delivery Summary</h2>
            <p><strong>Requested delivery:</strong> ${escapeHtml(formatDate(orderRes.data.expected_delivery_date))}</p>
            <p><strong>Commercial lines:</strong> ${itemsRes.data?.length ?? 0}</p>
            <p><strong>Prepared for:</strong> Procurement and supplier dispatch</p>
          </div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Code</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>UOM</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals-wrap">
          <div class="notes">
            <h3>Notes</h3>
            <p>${escapeHtml(orderRes.data.notes ?? 'No additional delivery or supplier instructions were provided.')}</p>
          </div>
          <div class="totals">
            <table>
              <tr><td>Subtotal</td><td>${currencyFormatter.format(Number(orderRes.data.subtotal ?? 0))}</td></tr>
              <tr><td>Tax</td><td>${currencyFormatter.format(Number(orderRes.data.tax_amount ?? 0))}</td></tr>
              <tr><td>Discount</td><td>${currencyFormatter.format(Number(orderRes.data.discount_amount ?? 0))}</td></tr>
              <tr><td>Total</td><td>${currencyFormatter.format(Number(orderRes.data.total ?? 0))}</td></tr>
            </table>
          </div>
        </div>
      </div>

      <div class="footer">
        <div>
          <div class="signature">Authorized by ${escapeHtml(companyName)}</div>
        </div>
        <div class="terms">
          Please supply the listed items exactly as quoted unless changes are approved in writing. Reference the purchase order number on all delivery notes, invoices, and correspondence.
        </div>
      </div>
    </div>
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to render purchase order document.');
  }
}
