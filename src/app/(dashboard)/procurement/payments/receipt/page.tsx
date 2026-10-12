import Image from 'next/image';
import { notFound } from 'next/navigation';

import { getAuthContext } from '@/lib/api-auth';
import { formatCurrency } from '@/lib/money';
import { getCompanyProfile } from '@/lib/settings-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

import { PrintOnLoad, PrintReceiptButton } from '@/app/(dashboard)/sales/payments/receipt/print-on-load';

function readParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function formatPaymentMethod(value: unknown) {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function SupplierPaymentReceiptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const paymentId = readParam(params.paymentId);
  const autoPrint = readParam(params.autoprint) === '1';
  const requestedPaper = readParam(params.paper, '80mm').toLowerCase();
  const paperSize = requestedPaper === 'a4' ? 'a4' : requestedPaper.startsWith('58') ? '58mm' : '80mm';
  const ctx = await getAuthContext();
  if (!ctx || !paymentId) notFound();

  const service = createServiceRoleClient().schema('icecream_erp');
  const { data: payment, error } = await service
    .from('supplier_payments')
    .select(
      `id, supplier_id, supplier_invoice_id, purchase_order_id, goods_received_note_id, grn_id,
       payment_date, payment_method, payment_source_type, reference_number, amount_paid, remarks, status, created_by,
       suppliers(id, code, name),
       supplier_invoices(id, invoice_number, invoice_total, outstanding_amount, status),
       purchase_orders(id, po_number),
       goods_received_notes(id, grn_number)`,
    )
    .eq('organization_id', ctx.organizationId)
    .eq('id', paymentId)
    .maybeSingle();

  if (error || !payment) notFound();

  const company = await getCompanyProfile().catch(() => null);
  const supplier = Array.isArray(payment.suppliers) ? payment.suppliers[0] : payment.suppliers;
  const invoice = Array.isArray(payment.supplier_invoices) ? payment.supplier_invoices[0] : payment.supplier_invoices;
  const po = Array.isArray(payment.purchase_orders) ? payment.purchase_orders[0] : payment.purchase_orders;
  const grn = Array.isArray(payment.goods_received_notes) ? payment.goods_received_notes[0] : payment.goods_received_notes;
  const amountPaid = Number(payment.amount_paid ?? 0);
  const invoiceTotal = Number(invoice?.invoice_total ?? amountPaid);
  const outstanding = Number(invoice?.outstanding_amount ?? Math.max(0, invoiceTotal - amountPaid));
  const companyName = company?.name?.trim() || 'Absolute Quality Icecream';

  return (
    <main
      className="receipt-print-shell min-h-screen bg-white px-4 py-6 text-brown print:px-0 print:py-0"
      data-receipt-paper={paperSize}
    >
      <PrintOnLoad enabled={autoPrint} />
      <div className="receipt-print-card mx-auto max-w-4xl rounded-[28px] border border-border/70 bg-white shadow-lg print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="receipt-no-print flex items-center justify-end gap-3 border-b border-border/70 px-8 py-4 print:hidden">
          <PrintReceiptButton />
        </div>

        <section className="border-b border-border/70 px-8 py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Image src="/icon.png" alt="Absolute Quality Icecream logo" className="h-16 w-16 rounded-2xl object-contain" height={64} priority width={64} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Supplier Payment Receipt</p>
                  <h1 className="mt-2 text-3xl font-semibold text-brown">{companyName}</h1>
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted">
                {company?.address ? <p>{company.address}</p> : null}
                {company?.phone ? <p>{company.phone}</p> : null}
                {company?.email ? <p>{company.email}</p> : null}
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-white px-5 py-4 text-sm shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Receipt Number</p>
              <p className="mt-2 text-xl font-semibold text-brown">SUP-PAY-{String(payment.id).slice(0, 8).toUpperCase()}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">Date</p>
              <p className="mt-2 font-medium text-brown">{String(payment.payment_date ?? '')}</p>
            </div>
          </div>
        </section>

        <section className="space-y-8 px-8 py-8">
          <div className="grid gap-4 md:grid-cols-2">
            <MetaRow label="Supplier" value={String(supplier?.name ?? supplier?.code ?? 'Unknown supplier')} />
            <MetaRow label="Invoice" value={String(invoice?.invoice_number ?? payment.supplier_invoice_id ?? 'Not linked')} />
            <MetaRow label="Purchase Order" value={String(po?.po_number ?? 'Not linked')} />
            <MetaRow label="GRN" value={String(grn?.grn_number ?? payment.grn_id ?? 'Not linked')} />
            <MetaRow label="Payment Method" value={formatPaymentMethod(payment.payment_source_type ?? payment.payment_method)} />
            <MetaRow label="Reference" value={String(payment.reference_number ?? '-')} />
          </div>

          <div className="overflow-hidden rounded-[28px] border border-border/70">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-cream/70 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">UOM</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/60">
                  <td className="px-4 py-3">Supplier invoice settlement</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">EA</td>
                  <td className="px-4 py-3">{formatCurrency(amountPaid)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-border/70 bg-cream/50 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Notes</p>
              <p className="mt-3 min-h-20 text-sm leading-6 text-brown">{String(payment.remarks ?? '') || 'Supplier payment recorded.'}</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-white px-5 py-5">
              <SummaryRow label="Invoice Total" value={invoiceTotal} />
              <SummaryRow label="Amount Paid" value={amountPaid} emphasized />
              <SummaryRow label="Outstanding Balance" value={outstanding} />
            </div>
          </div>

          <div className="border-t border-dashed border-border/80 pt-5 text-center text-sm text-muted">
            This receipt was generated from Absolute Ice Cream ERP.
          </div>
        </section>
      </div>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-brown">{value}</p>
    </div>
  );
}

function SummaryRow({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: number }) {
  return (
    <div className={`flex items-center justify-between py-2 ${emphasized ? 'text-base font-semibold text-brown' : 'text-sm text-muted'}`}>
      <span>{label}</span>
      <span>{formatCurrency(Number.isFinite(value) ? value : 0)}</span>
    </div>
  );
}
