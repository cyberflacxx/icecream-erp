'use client';

import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { Button } from '@/components/ui/button';
import { type RecordPaymentResponse, useRecordPayment } from '@/hooks/sales/useRecordPayment';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { useSalesPayments } from '@/hooks/sales/useSalesPayments';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { buildSalesReceiptPrintUrl } from '@/lib/sales-payments';

const initialPaymentForm = {
  amount: '0',
  customerId: '',
  invoiceId: '',
  notes: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'CASH' as 'CASH' | 'BANK' | 'PETTY_CASH',
  referenceNumber: '',
};

export default function SalesPaymentsPage() {
  const query = useSalesPayments();
  const metaQuery = useSalesMeta();
  const recordPayment = useRecordPayment();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialPaymentForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<'save' | 'print'>('save');

  const selectedInvoice = metaQuery.data?.invoices.find((invoice) => invoice.id === formState.invoiceId);
  const selectedCustomer = metaQuery.data?.customers.find((customer) => customer.id === formState.customerId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.invoiceId || !formState.customerId) {
      setFormError('Invoice is required.');
      return;
    }

    try {
      const response = await recordPayment.mutateAsync({
        amount: Number(formState.amount),
        customerId: formState.customerId,
        invoiceId: formState.invoiceId,
        notes: formState.notes || undefined,
        paymentDate: formState.paymentDate,
        paymentMethod: formState.paymentMethod,
        referenceNumber: formState.referenceNumber || undefined,
      });

      maybePrintReceipt(response);
      setFormState(initialPaymentForm);
      setFormError(null);
      setIsDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to record receipt.');
    }
  }

  function maybePrintReceipt(response: RecordPaymentResponse) {
    if (submitMode !== 'print') return;

    const payment = response.payment;
    const printUrl = buildSalesReceiptPrintUrl(
      {
        amount: Number(payment.amount ?? formState.amount),
        customerName: selectedCustomer?.name ?? 'Customer',
        invoiceNumber: selectedInvoice?.invoiceNumber ?? 'Invoice',
        notes: formState.notes || undefined,
        paymentDate: String(payment.payment_date ?? formState.paymentDate),
        paymentMethod: String(payment.payment_method ?? formState.paymentMethod),
        paymentNumber: String(payment.payment_number ?? 'Pending'),
        referenceNumber: payment.reference_number ?? formState.referenceNumber ?? undefined,
      },
      { autoPrint: true },
    );

    window.open(printUrl, '_blank', 'noopener,noreferrer');
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Payments unavailable" description={query.error?.message ?? 'No payment data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        description="Track customer payments, methods, references, and posted amounts."
        actions={
          <Button type="button" size="sm" onClick={() => {
            setFormError(null);
            setFormState(initialPaymentForm);
            setIsDrawerOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Record Receipt
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'payment_number', header: 'Payment #' },
          { key: 'payment_date', header: 'Payment Date' },
          { key: 'amount', header: 'Amount' },
          { key: 'payment_method', header: 'Method' },
          { key: 'reference_number', header: 'Reference' },
          { key: 'status', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No receipts found" description="Record customer receipts against invoices." />}
      />
      <FormDrawer title="Record Receipt" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Invoice</span>
            <select
              className="surface-input-soft"
              required
              value={formState.invoiceId}
              onChange={(event) => {
                const invoice = metaQuery.data?.invoices.find((row) => row.id === event.target.value);
                setFormError(null);
                setFormState((current) => ({
                  ...current,
                  amount: invoice ? String(invoice.balanceDue) : current.amount,
                  customerId: invoice?.customerId ?? '',
                  invoiceId: event.target.value,
                }));
              }}
            >
              <option value="">Select invoice</option>
              {metaQuery.data?.invoices.filter((invoice) => invoice.balanceDue > 0).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - balance {Number(invoice.balanceDue).toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          {selectedInvoice ? (
            <div className="rounded-3xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,247,232,0.96),rgba(255,255,255,0.92))] px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Customer</p>
                  <p className="mt-1 text-sm font-medium text-brown">{selectedCustomer?.name ?? 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Invoice</p>
                  <p className="mt-1 text-sm font-medium text-brown">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Outstanding Balance</p>
                  <p className="mt-1 text-sm font-medium text-brown">{Number(selectedInvoice.balanceDue).toFixed(2)}</p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Receipt date</span>
              <input
                className="surface-input-soft"
                required
                type="date"
                value={formState.paymentDate}
                onChange={(event) => {
                  setFormError(null);
                  setFormState((current) => ({ ...current, paymentDate: event.target.value }));
                }}
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Amount</span>
              <input
                className="surface-input-soft"
                min="0.01"
                step="0.01"
                type="number"
                value={formState.amount}
                onChange={(event) => {
                  setFormError(null);
                  setFormState((current) => ({ ...current, amount: event.target.value }));
                }}
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Source of payment</span>
              <select
                className="surface-input-soft"
                value={formState.paymentMethod}
                onChange={(event) => {
                  setFormError(null);
                  setFormState((current) => ({ ...current, paymentMethod: event.target.value as typeof current.paymentMethod }));
                }}
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="PETTY_CASH">Petty cash</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Reference</span>
              <input
                className="surface-input-soft"
                value={formState.referenceNumber}
                onChange={(event) => {
                  setFormError(null);
                  setFormState((current) => ({ ...current, referenceNumber: event.target.value }));
                }}
              />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              className="surface-textarea-soft"
              rows={3}
              value={formState.notes}
              onChange={(event) => {
                setFormError(null);
                setFormState((current) => ({ ...current, notes: event.target.value }));
              }}
            />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={recordPayment.isPending} onClick={() => setSubmitMode('save')}>
              {recordPayment.isPending && submitMode === 'save' ? 'Saving...' : 'Save'}
            </Button>
            <Button type="submit" variant="secondary" disabled={recordPayment.isPending} onClick={() => setSubmitMode('print')}>
              {recordPayment.isPending && submitMode === 'print' ? 'Saving & opening...' : 'Save & Print'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
