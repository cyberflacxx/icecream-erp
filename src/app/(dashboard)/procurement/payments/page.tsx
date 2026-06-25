'use client';

import { Plus, WalletCards } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
  paymentDate: '',
  paymentMethod: 'BANK',
  referenceNumber: '',
  remarks: '',
  supplierInvoiceId: '',
};

function paymentSourceLabel(value: string) {
  return paymentSources.find((source) => source.value === value)?.label ?? value;
}

export default function ProcurementPaymentsPage() {
  const canCreate = usePermission([PERMISSIONS.payment.create, 'procurement.write', 'finance.write']);
  const query = useSupplierPayments();
  const invoicesQuery = useSupplierInvoices();
  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  const payableInvoices = useMemo(
    () => (invoicesQuery.data ?? []).filter((invoice) => invoice.balance > 0),
    [invoicesQuery.data],
  );
  const selectedInvoice = payableInvoices.find((invoice) => invoice.id === formState.supplierInvoiceId) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
          paymentDate: formState.paymentDate || undefined,
          paymentMethod: formState.paymentMethod,
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
      await queryClient.invalidateQueries({ queryKey: ['procurement'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to enter supplier payment.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Payments"
        description="Review posted supplier payments, linked invoices, methods, and references for accounts payable tracking."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Payment
            </Button>
          ) : null
        }
      />
      <ProcurementNav />
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
        ]}
        emptyState={<EmptyState icon={<WalletCards className="h-6 w-6" />} title="No supplier payments found" description="Use New Payment to settle supplier invoices from bank, cash, or petty cash." />}
      />

      <FormDrawer title="New Supplier Payment" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <label className="space-y-2 text-sm text-muted">
            <span>Supplier Invoice</span>
            <select
              required
              value={formState.supplierInvoiceId}
              onChange={(event) => setFormState((current) => ({ ...current, supplierInvoiceId: event.target.value }))}
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
                onChange={(event) => setFormState((current) => ({ ...current, paymentMethod: event.target.value }))}
                className="surface-input-soft"
              >
                {paymentSources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
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
