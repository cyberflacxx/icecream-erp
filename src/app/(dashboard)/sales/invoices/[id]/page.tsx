'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui-library';
import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

type InvoiceDetail = {
  amount_paid?: number;
  approved_by?: string | null;
  balance_due?: number;
  branch?: {
    address?: string | null;
    code?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  company?: {
    address?: string | null;
    currency?: string | null;
    email?: string | null;
    logo_url?: string | null;
    name?: string | null;
    phone?: string | null;
    tax_number?: string | null;
  } | null;
  customers?: {
    address?: string | null;
    code?: string | null;
    email?: string | null;
    name?: string | null;
    payment_terms?: string | null;
    phone?: string | null;
    tax_number?: string | null;
  } | null;
  displayStatus?: string;
  discount_amount?: number | null;
  due_date?: string | null;
  id: string;
  invoice_date?: string | null;
  invoice_items?: Array<{
    discount_percent?: number | null;
    item_id?: string | null;
    items?: {
      code?: string | null;
      name?: string | null;
    } | null;
    quantity?: number | null;
    total_price?: number | null;
    unit_price?: number | null;
  }>;
  invoice_number?: string | null;
  notes?: string | null;
  payments?: Array<{
    amount?: number | null;
    payment_date?: string | null;
    payment_method?: string | null;
    payment_number?: string | null;
    reference_number?: string | null;
  }>;
  posted_by?: string | null;
  tax_amount?: number | null;
  total?: number | null;
  total_amount?: number | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export default function SalesInvoicePreviewPage({ params }: { params: { id: string } }) {
  const { getToken, isLoaded, isSignedIn } = useAppAuth();

  const query = useQuery({
    queryKey: ['sales', 'invoice-preview', params.id],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<InvoiceDetail>(`/api/sales/invoices/${params.id}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });

  const invoice = query.data;
  const lines = useMemo(() => invoice?.invoice_items ?? [], [invoice?.invoice_items]);
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      return sum + Number(line.total_price ?? (Number(line.quantity ?? 0) * Number(line.unit_price ?? 0)));
    }, 0);
    const grandTotal = Number(invoice?.total ?? invoice?.total_amount ?? subtotal);
    const amountPaid = Number(invoice?.amount_paid ?? 0);
    const discount = Number(invoice?.discount_amount ?? 0);
    const tax = Number(invoice?.tax_amount ?? Math.max(0, grandTotal - subtotal + discount));
    return {
      amountPaid,
      balanceDue: Number(invoice?.balance_due ?? Math.max(0, grandTotal - amountPaid)),
      discount,
      grandTotal,
      subtotal,
      tax,
    };
  }, [invoice, lines]);
  const latestPayment = invoice?.payments?.[0] ?? null;

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !invoice) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-rose-700">{query.error instanceof Error ? query.error.message : 'Invoice could not be loaded.'}</p>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef7ef] px-4 py-6 text-[#17351f] print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#b7d7bd] bg-white shadow-lg print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-6 py-4 print:hidden">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Download/Print
          </Button>
        </div>

        <section className="space-y-8 px-6 py-6 print:px-8 print:py-8">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="flex items-start gap-4">
              <Image
                src="/icon.png"
                alt="Absolute Quality Icecream logo"
                className="h-20 w-20 rounded-2xl object-contain"
                height={80}
                priority
                width={80}
              />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2d7a3c]">Absolute Quality Icecream</p>
                <h1 className="text-2xl font-black uppercase tracking-tight">{invoice.company?.name ?? 'Absolute Quality Icecream'}</h1>
                <p className="text-sm text-slate-600">{invoice.company?.address ?? 'Address not configured'}</p>
                <p className="text-sm text-slate-600">
                  {[invoice.company?.phone, invoice.company?.email].filter(Boolean).join(' | ') || 'Contact details not configured'}
                </p>
                <p className="text-sm text-slate-600">Tax ID: {invoice.company?.tax_number ?? 'Not configured'}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-[#b7d7bd] bg-[#f7fff8] p-5 text-sm">
              <h2 className="text-right text-4xl font-black uppercase tracking-tight text-[#1f6f32]">Invoice</h2>
              <InvoiceMeta label="Invoice No." value={invoice.invoice_number ?? invoice.id} />
              <InvoiceMeta label="Date" value={invoice.invoice_date ?? '-'} />
              <InvoiceMeta label="Due Date" value={invoice.due_date ?? '-'} />
            </div>
          </div>

          <div className="-mx-6 bg-[#1f7a3a] px-6 py-4 text-center text-white print:-mx-8 print:px-8">
            <p className="text-lg font-black uppercase tracking-[0.22em]">Absolute Quality Icecream</p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em]">Richer, Creamier Taste</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-[#b7d7bd] px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d7a3c]">From</p>
              <p className="text-base font-semibold">{invoice.company?.name ?? 'Absolute Quality Icecream'}</p>
              <p className="text-sm text-slate-600">{invoice.company?.address ?? 'Address not configured'}</p>
              <p className="text-sm text-slate-600">
                {[invoice.company?.phone, invoice.company?.email].filter(Boolean).join(' | ') || 'Contact details not configured'}
              </p>
              <p className="text-sm text-slate-600">Tax ID: {invoice.company?.tax_number ?? 'Not configured'}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-[#b7d7bd] px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d7a3c]">Bill To</p>
              <p className="text-base font-medium">{invoice.customers?.name ?? 'Customer'}</p>
              <p className="text-sm text-slate-600">{invoice.customers?.address ?? 'Address not available'}</p>
              <p className="text-sm text-slate-600">
                {[invoice.customers?.phone, invoice.customers?.email].filter(Boolean).join(' | ') || 'Contact details not available'}
              </p>
              <p className="text-sm text-slate-600">Tax ID: {invoice.customers?.tax_number ?? 'N/A'}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#b7d7bd]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#e4f5e7] text-left text-[#17351f] print:table-header-group">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Item / Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Unit Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Tax</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.item_id ?? index}`} className="border-t border-border/60">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{line.items?.name ?? line.item_id ?? '-'}</p>
                      <p className="text-xs text-slate-500">{line.items?.code ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{Number(line.quantity ?? 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-right">{currencyFormatter.format(Number(line.unit_price ?? 0))}</td>
                    <td className="px-4 py-3 text-right">{currencyFormatter.format(0)}</td>
                    <td className="px-4 py-3 text-right">{currencyFormatter.format(Number(line.total_price ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-[#b7d7bd] px-4 py-4 text-sm text-slate-600">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d7a3c]">Payment & Notes</p>
              <p className="mt-2">Method: {latestPayment?.payment_method ?? 'Not recorded'}</p>
              <p>Reference: {latestPayment?.reference_number ?? latestPayment?.payment_number ?? 'Not recorded'}</p>
              <p>Account: {invoice.branch?.name ?? 'Not assigned'}</p>
              <p className="mt-2 whitespace-pre-wrap">{invoice.notes ?? 'No invoice notes were saved.'}</p>
            </div>
            <div className="rounded-2xl border border-[#b7d7bd] bg-[#f7fff8] px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d7a3c]">Invoice Summary</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Subtotal</span>
                  <span>{currencyFormatter.format(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Discount</span>
                  <span>{currencyFormatter.format(totals.discount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Tax / VAT</span>
                  <span>{currencyFormatter.format(totals.tax)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#b7d7bd] pt-3 text-base font-bold">
                  <span>Total</span>
                  <span>{currencyFormatter.format(totals.grandTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Amount Paid</span>
                  <span>{currencyFormatter.format(totals.amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/70 pt-3 text-base font-semibold">
                  <span>Balance Due</span>
                  <span>{currencyFormatter.format(totals.balanceDue)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[#b7d7bd] bg-white px-4 py-4 text-sm md:grid-cols-4">
            <InvoiceMeta label="ERP Ref" value={invoice.id} />
            <InvoiceMeta label="Salesperson" value={invoice.posted_by ?? invoice.approved_by ?? '-'} />
            <InvoiceMeta label="Currency" value={invoice.company?.currency ?? 'USD'} />
            <InvoiceMeta label="Status" value={invoice.displayStatus ?? 'DRAFT'} />
          </div>

          <p className="border-t border-dashed border-[#b7d7bd] pt-5 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#2d7a3c]">
            Thank you for choosing Absolute Quality Icecream
          </p>
        </section>
      </div>
    </main>
  );
}

function InvoiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#2d7a3c]">{label}</span>
      <span className="text-right font-medium text-[#17351f]">{value}</span>
    </div>
  );
}
