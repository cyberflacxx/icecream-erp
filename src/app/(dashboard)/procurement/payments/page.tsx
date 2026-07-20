'use client';

import { Plus, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, StatusBadge } from '@/components/ui-library';
import { useProcurementRequest, useSupplierInvoices, useSupplierPayments } from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const paymentSources = [
  { label: 'Bank', value: 'BANK' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Petty Cash', value: 'PETTY_CASH' },
];

const initialFormState = {
  amountPaid: '',
  bankAccountId: '',
  cashAccountId: '',
  paymentDate: '',
  paymentMethod: 'BANK',
  pettyCashRequestId: '',
  referenceNumber: '',
  remarks: '',
  supplierInvoiceId: '',
};

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

function paymentSourceLabel(value: string) {
  return paymentSources.find((source) => source.value === value)?.label ?? value;
}

export default function ProcurementPaymentsPage() {
  const searchParams = useSearchParams();
  const requestedInvoiceId = searchParams.get('invoiceId');
  const canCreate = usePermission([PERMISSIONS.payment.create, 'procurement.write', 'finance.write']);
  const query = useSupplierPayments();
  const invoicesQuery = useSupplierInvoices();
  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const payableInvoices = useMemo(
    () => (invoicesQuery.data ?? []).filter((invoice) => invoice.balance > 0),
    [invoicesQuery.data],
  );
  const bankAccountsQuery = useQuery({
    queryKey: ['finance', 'bank-accounts', 'active'],
    queryFn: () =>
      request<Array<{ account_name?: string | null; bank_name?: string | null; id: string }>>(
        '/api/finance/bank-accounts?activeOnly=true',
      ),
    enabled: isDrawerOpen,
  });
  const cashAccountsQuery = useQuery({
    queryKey: ['finance', 'cash-accounts'],
    queryFn: () => request<Array<{ id: string; name?: string | null }>>('/api/finance/cash-accounts'),
    enabled: isDrawerOpen,
  });
  const pettyCashQuery = useQuery({
    queryKey: ['finance', 'petty-cash'],
    queryFn: () =>
      request<Array<{ id: string; purpose?: string | null; requestNumber?: string | null; request_number?: string | null }>>(
        '/api/finance/petty-cash',
      ),
    enabled: isDrawerOpen,
  });
  const selectedInvoice = payableInvoices.find((invoice) => invoice.id === formState.supplierInvoiceId) ?? null;

  useEffect(() => {
    if (!requestedInvoiceId || !payableInvoices.length) return;

    const requestedInvoice = payableInvoices.find((invoice) => invoice.id === requestedInvoiceId);
    if (!requestedInvoice) return;

    setFormState((current) => ({
      ...current,
      amountPaid: current.amountPaid || requestedInvoice.balance.toFixed(2),
      supplierInvoiceId: requestedInvoice.id,
    }));
    setIsDrawerOpen(true);
    setFeedback(null);
  }, [payableInvoices, requestedInvoiceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!selectedInvoice) {
      setFormError('Select an unpaid supplier invoice.');
      return;
    }

    const amountPaid = Number(formState.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0 || amountPaid > selectedInvoice.balance) {
      setFormError(`Amount must be greater than zero and not more than ${currencyFormatter.format(selectedInvoice.balance)}.`);
      return;
    }

    try {
      await request('/api/procurement/supplier-payments', {
        body: JSON.stringify({
          amountPaid,
          bankAccountId: formState.paymentMethod === 'BANK' ? formState.bankAccountId || null : null,
          cashAccountId: formState.paymentMethod === 'CASH' ? formState.cashAccountId || null : null,
          goodsReceivedNoteId: selectedInvoice.goodsReceivedNoteId,
          paymentDate: formState.paymentDate || undefined,
          paymentMethod: formState.paymentMethod,
          pettyCashRequestId: formState.paymentMethod === 'PETTY_CASH' ? formState.pettyCashRequestId || null : null,
          purchaseOrderId: selectedInvoice.purchaseOrderId,
          referenceNumber: formState.referenceNumber || null,
          remarks: formState.remarks || null,
          supplierId: selectedInvoice.supplierId,
          supplierInvoiceId: selectedInvoice.id,
        }),
        method: 'POST',
      });

      setFormError(null);
      setFormState(initialFormState);
      setIsDrawerOpen(false);
      setFeedback({ message: 'Supplier payment posted successfully.', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['procurement'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enter supplier payment.';
      setFormError(message);
      setFeedback({ message, tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Payments"
        description="Settle supplier balances with full invoice context so procurement, finance, and payable history stay in step."
        actions={
          canCreate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setFormError(null);
                setFeedback(null);
                setIsDrawerOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Payment
            </Button>
          ) : null
        }
      />
      <ProcurementNav />

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {requestedInvoiceId && selectedInvoice ? (
        <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Quick Pay Invoice</p>
              <h2 className="text-xl font-semibold text-brown">{selectedInvoice.invoiceNumber}</h2>
              <p className="text-sm text-sky-900/80">{selectedInvoice.supplierName}</p>
            </div>
            <div className="grid gap-3 text-sm text-sky-900 sm:grid-cols-3">
              <div className="rounded-2xl border border-sky-200 bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-sky-700">Balance</p>
                <p className="mt-2 font-semibold">{currencyFormatter.format(selectedInvoice.balance)}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-sky-700">PO Link</p>
                <p className="mt-2 font-semibold">{selectedInvoice.purchaseOrderNumber ?? 'No PO linked'}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-sky-700">GRN Link</p>
                <p className="mt-2 font-semibold">{selectedInvoice.goodsReceivedNoteNumber ?? 'No GRN linked'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'paymentDate', header: 'Payment Date' },
          { key: 'supplierName', header: 'Supplier' },
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'amountPaid', header: 'Amount', render: (row) => currencyFormatter.format(row.amountPaid) },
          { key: 'method', header: 'Source', render: (row) => paymentSourceLabel(row.method) },
          { key: 'reference', header: 'Reference' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) =>
              row.invoiceId ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/procurement/payments?invoiceId=${row.invoiceId}`}>Pay Again</Link>
                </Button>
              ) : (
                <span className="text-xs text-muted">No invoice link</span>
              ),
          },
        ]}
        emptyState={
          <EmptyState
            icon={<WalletCards className="h-6 w-6" />}
            title="No supplier payments found"
            description="Use New Payment to settle supplier invoices from bank, cash, or petty cash."
          />
        }
      />

      <FormDrawer title="New Supplier Payment" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Always pay against the invoice record so the supplier balance, procurement trail, and finance postings remain aligned.
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Supplier Invoice</span>
            <select
              required
              value={formState.supplierInvoiceId}
              onChange={(event) => {
                const supplierInvoiceId = event.target.value;
                const invoice = payableInvoices.find((row) => row.id === supplierInvoiceId) ?? null;
                setFormState((current) => ({
                  ...current,
                  amountPaid: invoice ? invoice.balance.toFixed(2) : current.amountPaid,
                  supplierInvoiceId,
                }));
              }}
              className="surface-input-soft"
            >
              <option value="">Select unpaid invoice</option>
              {payableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {invoice.supplierName} - Balance {currencyFormatter.format(invoice.balance)}
                </option>
              ))}
            </select>
          </label>

          {selectedInvoice ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Supplier</p>
                <p className="mt-2 text-brown">{selectedInvoice.supplierName}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Outstanding</p>
                <p className="mt-2 text-brown">{currencyFormatter.format(selectedInvoice.balance)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Purchase Order</p>
                <p className="mt-2 text-brown">{selectedInvoice.purchaseOrderNumber ?? 'No PO linked'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">GRN</p>
                <p className="mt-2 text-brown">{selectedInvoice.goodsReceivedNoteNumber ?? 'No GRN linked'}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Amount Paid</span>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={formState.amountPaid}
                onChange={(event) => setFormState((current) => ({ ...current, amountPaid: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Source of Payment</span>
              <select
                required
                value={formState.paymentMethod}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    bankAccountId: '',
                    cashAccountId: '',
                    paymentMethod: event.target.value,
                    pettyCashRequestId: '',
                  }))
                }
                className="surface-input-soft"
              >
                {paymentSources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
            {formState.paymentMethod === 'BANK' ? (
              <label className="space-y-2 text-sm text-muted">
                <span>Bank Account</span>
                <select
                  required
                  value={formState.bankAccountId}
                  onChange={(event) => setFormState((current) => ({ ...current, bankAccountId: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="">{bankAccountsQuery.isLoading ? 'Loading bank accounts...' : 'Select bank account'}</option>
                  {(bankAccountsQuery.data ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {[account.bank_name, account.account_name].filter(Boolean).join(' - ')}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {formState.paymentMethod === 'CASH' ? (
              <label className="space-y-2 text-sm text-muted">
                <span>Cash Account</span>
                <select
                  required
                  value={formState.cashAccountId}
                  onChange={(event) => setFormState((current) => ({ ...current, cashAccountId: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="">{cashAccountsQuery.isLoading ? 'Loading cash accounts...' : 'Select cash account'}</option>
                  {(cashAccountsQuery.data ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name ?? 'Cash account'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {formState.paymentMethod === 'PETTY_CASH' ? (
              <label className="space-y-2 text-sm text-muted">
                <span>Petty Cash Request</span>
                <select
                  required
                  value={formState.pettyCashRequestId}
                  onChange={(event) => setFormState((current) => ({ ...current, pettyCashRequestId: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="">{pettyCashQuery.isLoading ? 'Loading petty cash requests...' : 'Select petty cash request'}</option>
                  {(pettyCashQuery.data ?? []).map((requestRow) => (
                    <option key={requestRow.id} value={requestRow.id}>
                      {requestRow.requestNumber ?? requestRow.request_number ?? requestRow.purpose ?? 'Petty cash request'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Date</span>
              <input
                type="date"
                value={formState.paymentDate}
                onChange={(event) => setFormState((current) => ({ ...current, paymentDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Reference Number</span>
              <input
                value={formState.referenceNumber}
                onChange={(event) => setFormState((current) => ({ ...current, referenceNumber: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Remarks</span>
            <textarea
              rows={3}
              value={formState.remarks}
              onChange={(event) => setFormState((current) => ({ ...current, remarks: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Enter Payment</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
