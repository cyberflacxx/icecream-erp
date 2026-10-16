import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { formatCurrency } from '@/lib/money';
import { createBrandedPdfDocument } from '@/lib/pdf';
import { deriveSalesInvoiceStatus } from '@/lib/sales-workflow';
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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient().schema('icecream_erp');
  const id = params.id;

  try {
    const invoiceResult = await service
      .from('invoices')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (invoiceResult.error) return serverError(invoiceResult.error.message);
    if (!invoiceResult.data) return notFound('Invoice not found.');

    const invoice = invoiceResult.data as Record<string, unknown>;
    const customerId = invoice.customer_id ? String(invoice.customer_id) : null;

    const [customerResult, invoiceItemsResult, paymentsResult, companyResult] = await Promise.all([
      customerId
        ? service
            .from('customers')
            .select('*')
            .eq('organization_id', ctx.organizationId)
            .eq('id', customerId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      service.from('invoice_items').select('*').eq('invoice_id', id),
      service
        .from('payments')
        .select('payment_number, payment_method, reference_number, amount, payment_date')
        .eq('organization_id', ctx.organizationId)
        .eq('invoice_id', id)
        .order('payment_date', { ascending: false }),
      service
        .from('organizations')
        .select('id, name, address, phone, email, tax_number, currency')
        .eq('id', ctx.organizationId)
        .maybeSingle(),
    ]);

    if (customerResult.error) return serverError(customerResult.error.message);
    if (invoiceItemsResult.error) return serverError(invoiceItemsResult.error.message);
    if (paymentsResult.error) return serverError(paymentsResult.error.message);
    if (companyResult.error) return serverError(companyResult.error.message);

    const invoiceItems = (invoiceItemsResult.data ?? []) as Array<Record<string, unknown>>;
    const itemIds = [...new Set(invoiceItems.map((row) => String(row.item_id ?? '')).filter(Boolean))];
    let itemsById = new Map<string, Record<string, unknown>>();
    if (itemIds.length > 0) {
      const itemsResult = await service
        .from('items')
        .select('id, code, name')
        .eq('organization_id', ctx.organizationId)
        .in('id', itemIds);
      if (itemsResult.error) return serverError(itemsResult.error.message);
      itemsById = new Map(((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));
    }

    const company = (companyResult.data ?? {}) as Record<string, unknown>;
    const customer = (customerResult.data ?? {}) as Record<string, unknown>;
    const payments = (paymentsResult.data ?? []) as Array<Record<string, unknown>>;
    const invoiceNumber = String(invoice.invoice_number ?? id);
    const subtotal = invoiceItems.reduce((sum, line) =>
      sum + Number(line.total_price ?? (Number(line.quantity ?? 0) * Number(line.unit_price ?? 0))), 0);
    const total = Number(invoice.total ?? invoice.total_amount ?? subtotal);
    const discount = Number(invoice.discount_amount ?? 0);
    const tax = Number(invoice.tax_amount ?? Math.max(0, total - subtotal + discount));
    const amountPaid = Number(invoice.amount_paid ?? invoice.paid_amount ?? 0);
    const balanceDue = Number(invoice.balance_due ?? Math.max(0, total - amountPaid));
    const status = deriveSalesInvoiceStatus({
      amountPaid,
      approvedAt: invoice.approved_at,
      approvedBy: invoice.approved_by,
      balanceDue,
      postedAt: invoice.posted_at,
      postedBy: invoice.posted_by,
      status: invoice.status,
      total,
    });

    const pdf = Buffer.from(createBrandedPdfDocument({
      generatedAt: new Date().toISOString(),
      generatedBy: String(invoice.posted_by ?? invoice.approved_by ?? 'Absolute Ice Cream ERP'),
      title: 'SALES INVOICE',
      subtitle: invoiceNumber,
      footerNote: 'Thank you for choosing Absolute Quality Icecream.',
      metadata: [
        { label: 'Invoice No.', value: invoiceNumber },
        { label: 'Invoice Date', value: formatDate(invoice.invoice_date) },
        { label: 'Due Date', value: formatDate(invoice.due_date) },
        { label: 'Status', value: status },
        { label: 'Currency', value: String(company.currency ?? 'USD') },
      ],
      summary: [
        { label: 'Total', value: formatCurrency(total) },
        { label: 'Balance Due', value: formatCurrency(balanceDue) },
      ],
      table: {
        title: 'Invoice Items',
        columns: [
          { key: 'code', header: 'Code', width: 70 },
          { key: 'description', header: 'Item / Description', width: 190 },
          { key: 'quantity', header: 'Qty', width: 55, align: 'right' },
          { key: 'unitPrice', header: 'Unit Price', width: 85, align: 'right' },
          { key: 'amount', header: 'Amount', width: 95, align: 'right' },
        ],
        rows: invoiceItems.map((line) => {
          const item = itemsById.get(String(line.item_id ?? ''));
          const quantity = Number(line.quantity ?? 0);
          const unitPrice = Number(line.unit_price ?? 0);
          return {
            code: String(item?.code ?? '-'),
            description: String(item?.name ?? line.description ?? line.item_id ?? '-'),
            quantity,
            unitPrice,
            amount: Number(line.total_price ?? quantity * unitPrice),
          };
        }),
      },
      sections: [
        {
          title: 'Bill To',
          lines: [
            String(customer.name ?? 'Customer'),
            String(customer.address ?? '-'),
            [customer.phone, customer.email].filter(Boolean).map(String).join(' | ') || '-',
            `Tax ID: ${String(customer.tax_number ?? 'N/A')}`,
          ],
        },
        {
          title: 'Invoice Summary',
          lines: [
            `Subtotal: ${formatCurrency(subtotal)}`,
            `Discount: ${formatCurrency(discount)}`,
            `Tax / VAT: ${formatCurrency(tax)}`,
            `Total: ${formatCurrency(total)}`,
            `Amount Paid: ${formatCurrency(amountPaid)}`,
            `Balance Due: ${formatCurrency(balanceDue)}`,
          ],
        },
        {
          title: 'Payment / Notes',
          lines: [
            `Latest payment method: ${String(payments[0]?.payment_method ?? 'Not recorded')}`,
            `Latest payment reference: ${String(payments[0]?.reference_number ?? payments[0]?.payment_number ?? 'Not recorded')}`,
            String(invoice.notes ?? 'No invoice notes were saved.'),
          ],
        },
        {
          title: 'From',
          lines: [
            String(company.name ?? 'Absolute Quality Icecream'),
            String(company.address ?? '-'),
            [company.phone, company.email].filter(Boolean).map(String).join(' | ') || '-',
            `Tax ID: ${String(company.tax_number ?? 'Not configured')}`,
          ],
        },
      ],
    }));

    return new NextResponse(pdf, {
      headers: {
        'Content-Disposition': `attachment; filename="invoice-${sanitizeFileToken(invoiceNumber, 'invoice')}.pdf"`,
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Sales invoice PDF generation failed.', {
      invoiceId: id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      success: false,
      message: 'Invoice PDF could not be generated.',
      code: 'INVOICE_PDF_FAILED',
    }, { status: 500 });
  }
}
