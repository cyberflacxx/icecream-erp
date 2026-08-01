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
  posted_by?: string | null;
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
    return {
      amountPaid,
      balanceDue: Number(invoice?.balance_due ?? Math.max(0, grandTotal - amountPaid)),
      grandTotal,
      subtotal,
    };
  }, [invoice, lines]);

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
    <main className="min-h-screen bg-cream px-4 py-6 text-brown print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-3xl border border-border/70 bg-white shadow-lg print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-6 py-4 print:hidden">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print Invoice
          </Button>
        </div>

        <section className="space-y-8 px-6 py-6 print:px-8 print:py-8">
          <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
            <div className="space-y-3">
              {invoice.company?.logo_url ? (
                <Image
                  src={invoice.company.logo_url}
                  alt={invoice.company.name ?? 'Company logo'}
                  className="h-14 w-auto object-contain"
                  height={56}
                  unoptimized
                  width={160}
                />
              ) : null}
              <div>
                <h1 className="text-2xl font-semibold">{invoice.company?.name ?? 'Company'}</h1>
                <p className="text-sm text-muted">{invoice.company?.address ?? 'Address not configured'}</p>
                <p className="text-sm text-muted">
                  {[invoice.company?.phone, invoice.company?.email].filter(Boolean).join(' | ') || 'Contact details not configured'}
                </p>
                <p className="text-sm text-muted">Tax: {invoice.company?.tax_number ?? 'Not configured'}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Invoice</span>
                <span className="font-medium">{invoice.invoice_number ?? invoice.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Date</span>
                <span>{invoice.invoice_date ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Due Date</span>
                <span>{invoice.due_date ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <span>{invoice.displayStatus ?? 'DRAFT'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Prepared By</span>
                <span>{invoice.posted_by ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Approved By</span>
                <span>{invoice.approved_by ?? '-'}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Bill To</p>
              <p className="text-base font-medium">{invoice.customers?.name ?? 'Customer'}</p>
              <p className="text-sm text-muted">{invoice.customers?.address ?? 'Address not available'}</p>
              <p className="text-sm text-muted">
                {[invoice.customers?.phone, invoice.customers?.email].filter(Boolean).join(' | ') || 'Contact details not available'}
              </p>
              <p className="text-sm text-muted">Tax: {invoice.customers?.tax_number ?? 'N/A'}</p>
            </div>
            <div className="space-y-2 rounded-xl border border-border/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Branch</p>
              <p className="text-base font-medium">{invoice.branch?.name ?? 'Branch not assigned'}</p>
              <p className="text-sm text-muted">{invoice.branch?.address ?? 'Address not available'}</p>
              <p className="text-sm text-muted">{invoice.branch?.phone ?? 'Phone not available'}</p>
              <p className="text-sm text-muted">Terms: {invoice.customers?.payment_terms ?? 'Standard terms'}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-cream/70 text-left print:table-header-group">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item Code</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Unit Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Discount %</th>
                  <th className="px-4 py-3 font-semibold text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.item_id ?? index}`} className="border-t border-border/60">
                    <td className="px-4 py-3">{line.items?.code ?? '-'}</td>
                    <td className="px-4 py-3">{line.items?.name ?? line.item_id ?? '-'}</td>
                    <td className="px-4 py-3 text-right">{Number(line.quantity ?? 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-right">{currencyFormatter.format(Number(line.unit_price ?? 0))}</td>
                    <td className="px-4 py-3 text-right">{Number(line.discount_percent ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{currencyFormatter.format(Number(line.total_price ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border/70 px-4 py-4 text-sm text-muted">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Terms & Notes</p>
              <p className="mt-2 whitespace-pre-wrap">{invoice.notes ?? 'No invoice notes were saved.'}</p>
            </div>
            <div className="rounded-xl border border-border/70 px-4 py-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Subtotal</span>
                  <span>{currencyFormatter.format(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Grand Total</span>
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
        </section>
      </div>
    </main>
  );
}
