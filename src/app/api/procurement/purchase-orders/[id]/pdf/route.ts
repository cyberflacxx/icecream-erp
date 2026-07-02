import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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
    const { data: order, error } = await service
      .from('purchase_orders')
      .select(
        `id, po_number, order_date, expected_delivery_date, notes, subtotal, tax_amount, discount_amount, total,
         suppliers(name, email, phone, address)`,
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) return serverError(error.message);
    if (!order) return notFound('Purchase order not found.');

    const itemsRes = await service
      .from('purchase_order_items')
      .select('quantity_ordered, unit_cost, total_cost, unit_of_measure_id, items(code, name)')
      .eq('purchase_order_id', id)
      .order('created_at', { ascending: true });
    if (itemsRes.error) return serverError(itemsRes.error.message);

    const unitIds = [
      ...new Set(
        (itemsRes.data ?? [])
          .map((item) => String(item.unit_of_measure_id ?? ''))
          .filter(Boolean),
      ),
    ];
    const unitsRes = unitIds.length
      ? await service.from('units_of_measure').select('id, abbreviation').in('id', unitIds)
      : { data: [], error: null };
    if (unitsRes.error) return serverError(unitsRes.error.message);

    const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers;
    const items = itemsRes.data ?? [];
    const unitsById = new Map((unitsRes.data ?? []).map((unit) => [String(unit.id), unit]));
    const origin = request.nextUrl.origin;
    const rows = items
      .map((item, index) => {
        const product = Array.isArray(item.items) ? item.items[0] : item.items;
        const unit = unitsById.get(String(item.unit_of_measure_id ?? ''));
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${String(product?.code ?? '')}</td>
            <td>${String(product?.name ?? '')}</td>
            <td>${Number(item.quantity_ordered ?? 0)}</td>
            <td>${String(unit?.abbreviation ?? '')}</td>
            <td>${currencyFormatter.format(Number(item.unit_cost ?? 0))}</td>
            <td>${currencyFormatter.format(Number(item.total_cost ?? 0))}</td>
          </tr>
        `;
      })
      .join('');

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${String(order.po_number ?? 'Purchase Order')}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      .brand img { width: 140px; height: auto; }
      .brand h1 { margin: 12px 0 0; font-size: 22px; }
      .meta, .supplier { margin-top: 24px; width: 100%; border-collapse: collapse; }
      .meta td, .supplier td { padding: 6px 0; vertical-align: top; }
      table.items { width: 100%; border-collapse: collapse; margin-top: 24px; }
      table.items th, table.items td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
      table.items th { background: #f3f4f6; }
      .totals { margin-top: 24px; margin-left: auto; width: 320px; }
      .totals td { padding: 6px 0; }
      .notes { margin-top: 24px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; }
      @media print { body { margin: 18px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">
        <img src="${origin}/branding/logo.png" alt="Company logo" />
        <h1>Purchase Order</h1>
      </div>
      <div>
        <table class="meta">
          <tr><td><strong>PO Number</strong></td><td>${String(order.po_number ?? '')}</td></tr>
          <tr><td><strong>Order Date</strong></td><td>${String(order.order_date ?? '')}</td></tr>
          <tr><td><strong>Expected Delivery</strong></td><td>${String(order.expected_delivery_date ?? '-')}</td></tr>
        </table>
      </div>
    </div>

    <table class="supplier">
      <tr><td><strong>Supplier</strong></td><td>${String(supplier?.name ?? '')}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${String(supplier?.phone ?? '-')}</td></tr>
      <tr><td><strong>Email</strong></td><td>${String(supplier?.email ?? '-')}</td></tr>
      <tr><td><strong>Address</strong></td><td>${String(supplier?.address ?? '-')}</td></tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th>#</th>
          <th>Code</th>
          <th>Description</th>
          <th>Qty</th>
          <th>UOM</th>
          <th>Unit Cost</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><td><strong>Subtotal</strong></td><td>${currencyFormatter.format(Number(order.subtotal ?? 0))}</td></tr>
      <tr><td><strong>Tax</strong></td><td>${currencyFormatter.format(Number(order.tax_amount ?? 0))}</td></tr>
      <tr><td><strong>Discount</strong></td><td>${currencyFormatter.format(Number(order.discount_amount ?? 0))}</td></tr>
      <tr><td><strong>Total</strong></td><td>${currencyFormatter.format(Number(order.total ?? 0))}</td></tr>
    </table>

    <div class="notes">
      <strong>Notes</strong>
      <div>${String(order.notes ?? 'No additional notes.')}</div>
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
