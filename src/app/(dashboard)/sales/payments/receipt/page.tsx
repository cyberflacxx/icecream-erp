import { notFound } from 'next/navigation';

import { getAuthContext } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCompanyProfile } from '@/lib/settings-server';
import { formatPaymentMethodLabel } from '@/lib/sales-payments';

import { PrintOnLoad } from './print-on-load';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency',
});

function readParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

async function loadReceiptRecord(organizationId: string, paymentId: string) {
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
          .select('id, code, name, address, phone, email')
          .eq('organization_id', organizationId)
          .eq('id', customerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (customerResult.error) throw customerResult.error;

  const invoice = (invoiceResult.data ?? null) as Record<string, unknown> | null;
  const customer = (customerResult.data ?? null) as Record<string, unknown> | null;

  let branch: Record<string, unknown> | null = null;
  let warehouse: Record<string, unknown> | null = null;
  if (invoice?.branch_id) {
    const branchResult = await service
      .from('branches')
      .select('id, code, name, address, phone')
      .eq('organization_id', organizationId)
      .eq('id', String(invoice.branch_id))
      .maybeSingle();
    if (branchResult.error) throw branchResult.error;
    branch = (branchResult.data ?? null) as Record<string, unknown> | null;
  }
  if (invoice?.warehouse_id) {
    const warehouseResult = await service
      .from('warehouses')
      .select('id, code, name')
      .eq('organization_id', organizationId)
      .eq('id', String(invoice.warehouse_id))
      .maybeSingle();
    if (warehouseResult.error) throw warehouseResult.error;
    warehouse = (warehouseResult.data ?? null) as Record<string, unknown> | null;
  }

  return {
    branch,
    customer,
    invoice,
    payment,
    warehouse,
  };
}

export default async function SalesPaymentReceiptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const paymentId = readParam(params.paymentId);
  const autoPrint = readParam(params.autoprint) === '1';
  const ctx = await getAuthContext();
  if (!ctx || !paymentId) {
    notFound();
  }

  const company = await getCompanyProfile().catch(() => null);
  const receipt = await loadReceiptRecord(ctx.organizationId, paymentId).catch(() => null);
  if (!receipt) {
    notFound();
  }

  const companyName = company?.name?.trim() || 'Absolute Quality Icecream';
  const companyAddress = company?.address?.trim() || '';
  const companyPhone = company?.phone?.trim() || '';
  const companyEmail = company?.email?.trim() || '';
  const companyTaxNumber = company?.tax_number?.trim() || '';

  const paymentNumber = String(receipt.payment.payment_number ?? 'Pending');
  const invoiceNumber = String(receipt.invoice?.invoice_number ?? receipt.invoice?.id ?? 'Not provided');
  const customerName = String(receipt.customer?.name ?? receipt.customer?.code ?? 'Customer');
  const paymentDate = String(receipt.payment.payment_date ?? receipt.invoice?.invoice_date ?? '2026-08-02');
  const paymentMethod = String(receipt.payment.payment_method ?? 'CASH');
  const referenceNumber = String(receipt.payment.reference_number ?? '');
  const notes = String(receipt.payment.notes ?? '');
  const amount = Number(receipt.payment.amount ?? 0);
  const amountPaid = Number(receipt.invoice?.amount_paid ?? receipt.invoice?.paid_amount ?? amount);
  const balanceDue = Number(receipt.invoice?.balance_due ?? 0);

  return (
    <main className="min-h-screen bg-cream px-4 py-6 text-brown print:bg-white print:px-0 print:py-0">
      <PrintOnLoad enabled={autoPrint} />
      <div className="mx-auto max-w-3xl rounded-[28px] border border-border/70 bg-white shadow-lg print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <section className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(255,247,232,0.95),rgba(255,255,255,0.98))] px-8 py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Customer Receipt</p>
                <h1 className="mt-2 text-3xl font-semibold text-brown">{companyName}</h1>
              </div>
              <div className="space-y-1 text-sm text-muted">
                {companyAddress ? <p>{companyAddress}</p> : null}
                {companyPhone ? <p>{companyPhone}</p> : null}
                {companyEmail ? <p>{companyEmail}</p> : null}
                {companyTaxNumber ? <p>Tax No: {companyTaxNumber}</p> : null}
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-white/90 px-5 py-4 text-sm shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Receipt Number</p>
              <p className="mt-2 text-xl font-semibold text-brown">{paymentNumber}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">Receipt Date</p>
              <p className="mt-2 font-medium text-brown">{new Date(paymentDate).toLocaleDateString()}</p>
            </div>
          </div>
        </section>

        <section className="px-8 py-8">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard label="Received From" value={customerName} />
            <DetailCard label="Invoice Number" value={invoiceNumber} />
            <DetailCard label="Payment Method" value={formatPaymentMethodLabel(paymentMethod)} />
            <DetailCard label="Reference Number" value={referenceNumber || 'Not provided'} />
            <DetailCard label="Branch" value={String(receipt.branch?.name ?? receipt.branch?.code ?? 'Not assigned')} />
            <DetailCard label="Warehouse" value={String(receipt.warehouse?.name ?? receipt.warehouse?.code ?? 'Not assigned')} />
          </div>

          <div className="mt-6 rounded-[28px] border border-orange/20 bg-[linear-gradient(135deg,rgba(255,248,238,1),rgba(255,255,255,1))] px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Amount Received</p>
            <p className="mt-3 text-4xl font-semibold text-brown">{currencyFormatter.format(Number.isFinite(amount) ? amount : 0)}</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <DetailCard label="Invoice Total" value={currencyFormatter.format(Number(receipt.invoice?.total ?? receipt.invoice?.total_amount ?? 0))} />
            <DetailCard label="Total Paid" value={currencyFormatter.format(amountPaid)} />
            <DetailCard label="Outstanding Balance" value={currencyFormatter.format(balanceDue)} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1.25fr,0.75fr]">
            <div className="rounded-3xl border border-border/70 bg-cream/60 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Notes</p>
              <p className="mt-3 min-h-20 text-sm leading-6 text-brown">{notes || 'No additional notes recorded for this receipt.'}</p>
            </div>

            <div className="rounded-3xl border border-border/70 bg-white px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Confirmation</p>
              <div className="mt-8 border-t border-dashed border-border/80 pt-4">
                <p className="text-sm font-medium text-brown">Authorized Signature</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-brown">{value}</p>
    </div>
  );
}
