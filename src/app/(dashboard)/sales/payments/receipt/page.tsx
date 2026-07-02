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

export default async function SalesPaymentReceiptPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const company = await getCompanyProfile().catch(() => null);
  const companyName = company?.name?.trim() || 'Absolute Quality Icecream';
  const companyAddress = company?.address?.trim() || '';
  const companyPhone = company?.phone?.trim() || '';
  const companyEmail = company?.email?.trim() || '';
  const companyTaxNumber = company?.tax_number?.trim() || '';

  const paymentNumber = readParam(searchParams.paymentNumber, 'Pending');
  const invoiceNumber = readParam(searchParams.invoiceNumber, 'Not provided');
  const customerName = readParam(searchParams.customerName, 'Walk-in customer');
  const paymentDate = readParam(searchParams.paymentDate, new Date().toISOString().slice(0, 10));
  const paymentMethod = readParam(searchParams.paymentMethod, 'CASH');
  const referenceNumber = readParam(searchParams.referenceNumber);
  const notes = readParam(searchParams.notes);
  const autoPrint = readParam(searchParams.autoprint) === '1';
  const amount = Number(readParam(searchParams.amount, '0'));

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
          </div>

          <div className="mt-6 rounded-[28px] border border-orange/20 bg-[linear-gradient(135deg,rgba(255,248,238,1),rgba(255,255,255,1))] px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Amount Received</p>
            <p className="mt-3 text-4xl font-semibold text-brown">{currencyFormatter.format(Number.isFinite(amount) ? amount : 0)}</p>
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
