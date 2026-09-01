import { notFound } from 'next/navigation';
import Image from 'next/image';

import { getAuthContext } from '@/lib/api-auth';
import { getActiveBranchWarehouse } from '@/lib/branches-server';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { buildBranchSaleReceiptNumber, formatPaymentMethodLabel } from '@/lib/sales-payments';
import { getCompanyProfile } from '@/lib/settings-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

import { PrintOnLoad, PrintReceiptButton } from './print-on-load';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency',
});

function readParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function resolveReceiptPaper(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === '58' || normalized === '58mm' ? '58mm' : '80mm';
}

type ReceiptLine = {
  lineTotal: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

type ReceiptRecord = {
  amountPaid: number;
  balanceDue: number;
  branchName: string;
  cashierName: string;
  changeAmount: number;
  customerName: string;
  dateTime: string;
  discountAmount: number;
  lines: ReceiptLine[];
  notes: string;
  paymentMethod: string;
  referenceNumber: string;
  receiptNumber: string;
  sourceLabel: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  warehouseName: string;
};

async function loadCashierName(service: ReturnType<typeof createServiceRoleClient>, userId: string | null) {
  if (!userId) return 'Unknown cashier';
  const result = await service
    .schema('icecream_erp')
    .from('users')
    .select('id, full_name, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  if (result.error || !result.data) return userId;

  const fullName = String(result.data.full_name ?? '').trim();
  if (fullName) return fullName;
  const firstName = String(result.data.first_name ?? '').trim();
  const lastName = String(result.data.last_name ?? '').trim();
  return `${firstName} ${lastName}`.trim() || userId;
}

async function loadBranchSaleReceiptRecord(organizationId: string, branchSaleId: string): Promise<ReceiptRecord | null> {
  const service = createServiceRoleClient().schema('icecream_erp');
  const buildSaleQuery = (selectClause: string) => service
      .from('branch_sales')
      .select(selectClause)
      .eq('organization_id', organizationId)
      .eq('id', branchSaleId)
      .maybeSingle();
  let saleResult = await buildSaleQuery(
    'id, branch_id, customer_id, sale_number, sale_date, total_amount, discount_amount, tax_amount, payment_method, payment_reference, remarks, served_by',
  );
  if (saleResult.error && isMissingColumnError(saleResult.error, 'branch_sales', 'customer_id')) {
    saleResult = await buildSaleQuery(
      'id, branch_id, sale_number, sale_date, total_amount, discount_amount, tax_amount, payment_method, payment_reference, remarks, served_by',
    );
  }
  if (saleResult.error) throw saleResult.error;
  if (!saleResult.data) return null;

  const sale = saleResult.data as unknown as Record<string, unknown>;
  const branchId = String(sale.branch_id ?? '');
  const customerId = String(sale.customer_id ?? '');

  const [branchResult, itemsResult, customerResult, legacyBranchCustomerResult, cashierName, warehouse] = await Promise.all([
    service.from('branches').select('id, name, code').eq('organization_id', organizationId).eq('id', branchId).maybeSingle(),
    service
      .from('branch_sale_items')
      .select('quantity, unit_price, total_price, items(id, code, name)')
      .eq('branch_sale_id', branchSaleId),
    customerId
      ? service.from('customers').select('id, code, name').eq('organization_id', organizationId).eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    customerId
      ? service.from('branch_customers').select('id, customer_name, customer_code').eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadCashierName(createServiceRoleClient(), sale.served_by ? String(sale.served_by) : null),
    branchId ? getActiveBranchWarehouse(branchId).catch(() => null) : Promise.resolve(null),
  ]);

  if (branchResult.error) throw branchResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (customerResult.error) throw customerResult.error;
  if (legacyBranchCustomerResult.error) throw legacyBranchCustomerResult.error;

  const lines = (itemsResult.data ?? []).map((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    return {
      lineTotal: Number(row.total_price ?? Number(row.quantity ?? 0) * Number(row.unit_price ?? 0)),
      name: String((item as Record<string, unknown> | null)?.name ?? (item as Record<string, unknown> | null)?.code ?? 'Item'),
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unit_price ?? 0),
    } satisfies ReceiptLine;
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountAmount = Number(sale.discount_amount ?? 0);
  const taxAmount = Number(sale.tax_amount ?? 0);
  const total = Number(sale.total_amount ?? subtotal - discountAmount + taxAmount);

  return {
    amountPaid: String(sale.payment_method ?? '').toUpperCase() === 'CREDIT' ? 0 : total,
    balanceDue: String(sale.payment_method ?? '').toUpperCase() === 'CREDIT' ? total : 0,
    branchName: String(branchResult.data?.name ?? branchResult.data?.code ?? 'Branch'),
    cashierName,
    changeAmount: 0,
    customerName: String(customerResult.data?.name ?? customerResult.data?.code ?? legacyBranchCustomerResult.data?.customer_name ?? legacyBranchCustomerResult.data?.customer_code ?? 'Walk-in Customer'),
    dateTime: String(sale.sale_date ?? new Date().toISOString()),
    discountAmount,
    lines,
    notes: String(sale.remarks ?? ''),
    paymentMethod: String(sale.payment_method ?? 'CASH'),
    referenceNumber: String(sale.payment_reference ?? ''),
    receiptNumber: buildBranchSaleReceiptNumber(String(sale.sale_number ?? branchSaleId)),
    sourceLabel: String(sale.sale_number ?? branchSaleId),
    subtotal,
    taxAmount,
    total,
    warehouseName: String(warehouse?.name ?? warehouse?.code ?? 'Branch warehouse'),
  };
}

async function loadPaymentReceiptRecord(organizationId: string, paymentId: string): Promise<ReceiptRecord | null> {
  const service = createServiceRoleClient().schema('icecream_erp');

  const paymentResult = await service
    .from('payments')
    .select('id, organization_id, customer_id, invoice_id, payment_number, payment_date, amount, payment_method, reference_number, notes')
    .eq('organization_id', organizationId)
    .eq('id', paymentId)
    .maybeSingle();
  if (paymentResult.error) throw paymentResult.error;
  if (!paymentResult.data) return null;

  const payment = paymentResult.data as Record<string, unknown>;
  const invoiceId = payment.invoice_id ? String(payment.invoice_id) : null;
  const customerId = payment.customer_id ? String(payment.customer_id) : null;

  const [invoiceResult, customerResult] = await Promise.all([
    invoiceId
      ? service
          .from('invoices')
          .select('id, invoice_number, invoice_date, branch_id, warehouse_id, total, total_amount, amount_paid, paid_amount, balance_due')
          .eq('organization_id', organizationId)
          .eq('id', invoiceId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    customerId
      ? service
          .from('customers')
          .select('id, code, name')
          .eq('organization_id', organizationId)
          .eq('id', customerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (customerResult.error) throw customerResult.error;

  const invoice = (invoiceResult.data ?? null) as Record<string, unknown> | null;

  let branchName = 'Not assigned';
  let warehouseName = 'Not assigned';
  if (invoice?.branch_id) {
    const branchResult = await service
      .from('branches')
      .select('id, code, name')
      .eq('organization_id', organizationId)
      .eq('id', String(invoice.branch_id))
      .maybeSingle();
    if (branchResult.error) throw branchResult.error;
    branchName = String(branchResult.data?.name ?? branchResult.data?.code ?? branchName);
  }
  if (invoice?.warehouse_id) {
    const warehouseResult = await service
      .from('warehouses')
      .select('id, code, name')
      .eq('organization_id', organizationId)
      .eq('id', String(invoice.warehouse_id))
      .maybeSingle();
    if (warehouseResult.error) throw warehouseResult.error;
    warehouseName = String(warehouseResult.data?.name ?? warehouseResult.data?.code ?? warehouseName);
  }

  const amount = Number(payment.amount ?? 0);
  const invoiceTotal = Number(invoice?.total ?? invoice?.total_amount ?? amount);
  const amountPaid = Number(invoice?.amount_paid ?? invoice?.paid_amount ?? amount);
  const balanceDue = Number(invoice?.balance_due ?? 0);

  return {
    amountPaid: amount,
    balanceDue,
    branchName,
    cashierName: 'Accounts',
    changeAmount: 0,
    customerName: String(customerResult.data?.name ?? customerResult.data?.code ?? 'Customer'),
    dateTime: String(payment.payment_date ?? invoice?.invoice_date ?? new Date().toISOString()),
    discountAmount: 0,
    lines: [
      {
        lineTotal: invoiceTotal,
        name: `Invoice ${String(invoice?.invoice_number ?? invoiceId ?? 'Not provided')}`,
        quantity: 1,
        unitPrice: invoiceTotal,
      },
    ],
    notes: String(payment.notes ?? ''),
    paymentMethod: String(payment.payment_method ?? 'CASH'),
    referenceNumber: String(payment.reference_number ?? ''),
    receiptNumber: String(payment.payment_number ?? 'Pending'),
    sourceLabel: String(invoice?.invoice_number ?? invoiceId ?? 'Not provided'),
    subtotal: invoiceTotal,
    taxAmount: 0,
    total: invoiceTotal,
    warehouseName,
  };
}

function buildMetaRow(label: string, value: string) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-brown">{value}</p>
    </div>
  );
}

export default async function SalesPaymentReceiptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const paymentId = readParam(params.paymentId);
  const branchSaleId = readParam(params.branchSaleId);
  const autoPrint = readParam(params.autoprint) === '1';
  const paperSize = resolveReceiptPaper(readParam(params.paper));
  const ctx = await getAuthContext();
  if (!ctx || (!paymentId && !branchSaleId)) {
    notFound();
  }

  const company = await getCompanyProfile().catch(() => null);
  const receipt = branchSaleId
    ? await loadBranchSaleReceiptRecord(ctx.organizationId, branchSaleId).catch(() => null)
    : await loadPaymentReceiptRecord(ctx.organizationId, paymentId).catch(() => null);
  if (!receipt) {
    notFound();
  }

  const companyName = company?.name?.trim() || 'Absolute Ice Cream';
  const companyAddress = company?.address?.trim() || '';
  const companyPhone = company?.phone?.trim() || '';
  const companyEmail = company?.email?.trim() || '';

  return (
    <main
      className="receipt-print-shell min-h-screen bg-white px-4 py-6 text-brown print:px-0 print:py-0"
      data-receipt-paper={paperSize}
    >
      <PrintOnLoad enabled={autoPrint} />
      <div className="receipt-print-card mx-auto max-w-4xl rounded-[28px] border border-border/70 bg-white shadow-lg print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="receipt-no-print flex items-center justify-end border-b border-border/70 px-8 py-4 print:hidden">
          <PrintReceiptButton />
        </div>
        <section className="border-b border-border/70 px-8 py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Image
                  src="/icon.png"
                  alt="Absolute Quality Icecream logo"
                  className="h-16 w-16 rounded-2xl object-contain"
                  height={64}
                  priority
                  width={64}
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Printable Receipt</p>
                  <h1 className="mt-2 text-3xl font-semibold text-brown">ABSOLUTE QUALITY ICECREAM</h1>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange">Richer, Creamier Taste</p>
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted">
                {companyName !== 'Absolute Ice Cream' && companyName !== 'ABSOLUTE QUALITY ICECREAM' ? <p>{companyName}</p> : null}
                {companyAddress ? <p>{companyAddress}</p> : null}
                {companyPhone ? <p>{companyPhone}</p> : null}
                {companyEmail ? <p>{companyEmail}</p> : null}
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-white px-5 py-4 text-sm shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Receipt Number</p>
              <p className="mt-2 text-xl font-semibold text-brown">{receipt.receiptNumber}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">Date &amp; Time</p>
              <p className="mt-2 font-medium text-brown">{new Date(receipt.dateTime).toLocaleString()}</p>
            </div>
          </div>
        </section>

        <section className="px-8 py-8">
          <div className="grid gap-4 md:grid-cols-2">
            {buildMetaRow('Branch', receipt.branchName)}
            {buildMetaRow('Cashier', receipt.cashierName)}
            {buildMetaRow('Customer', receipt.customerName)}
            {buildMetaRow('Payment Method', formatPaymentMethodLabel(receipt.paymentMethod))}
          </div>

          <div className="mt-8 overflow-hidden rounded-[28px] border border-border/70">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-cream/70 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Unit Price</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((line, index) => (
                  <tr key={`${line.name}-${index}`} className="border-t border-border/60">
                    <td className="px-4 py-3">{line.name}</td>
                    <td className="px-4 py-3">{line.quantity.toFixed(3)}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(line.unitPrice)}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-border/70 bg-cream/50 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Notes</p>
              <p className="mt-3 min-h-20 text-sm leading-6 text-brown">
                {receipt.notes || 'Thank you for your business.'}
              </p>
            </div>

            <div className="rounded-3xl border border-border/70 bg-white px-5 py-5">
              <SummaryRow label="Subtotal" value={receipt.subtotal} />
              <SummaryRow label="Discount" value={receipt.discountAmount} />
              <SummaryRow label="Tax" value={receipt.taxAmount} />
              <SummaryRow label="Total" value={receipt.total} emphasized />
              <SummaryRow label="Amount Paid" value={receipt.amountPaid} />
              <SummaryRow label="Change" value={receipt.changeAmount} />
              <SummaryRow label="Balance Due" value={receipt.balanceDue} />
            </div>
          </div>

          <div className="mt-8 border-t border-dashed border-border/80 pt-5 text-center text-sm text-muted">
            Thank you for choosing Absolute Quality Icecream
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryRow({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: number }) {
  return (
    <div className={`flex items-center justify-between py-2 ${emphasized ? 'text-base font-semibold text-brown' : 'text-sm text-muted'}`}>
      <span>{label}</span>
      <span>{currencyFormatter.format(Number.isFinite(value) ? value : 0)}</span>
    </div>
  );
}
