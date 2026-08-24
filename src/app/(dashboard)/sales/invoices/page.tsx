'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus, ReceiptText, WalletCards } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { createSalesLineDraft, normalizeSalesLines, SalesLineItemsEditor } from '@/components/sales/sales-line-items-editor';
import { Button } from '@/components/ui/button';
import { useAuthorizedBranches } from '@/hooks/useAuthorizedBranches';
import { useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatCard } from '@/components/ui-library';
import { type InvoiceListItem, useInvoices } from '@/hooks/sales/useInvoices';
import { type RecordPaymentResponse, useRecordPayment } from '@/hooks/sales/useRecordPayment';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { useSalesRequest } from '@/hooks/sales/useSalesRequest';
import { buildSalesReceiptPrintUrl } from '@/lib/sales-payments';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

const initialInvoiceForm = {
  branchId: '',
  customerId: '',
  discountAmount: '0',
  dueDate: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  items: [createSalesLineDraft()],
  notes: '',
  salesOrderId: '',
  taxAmount: '0',
  warehouseId: '',
};

const initialReceiptForm = {
  amount: '0',
  bankAccountId: '',
  cashAccountId: '',
  customerId: '',
  invoiceId: '',
  notes: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'CASH' as 'CASH' | 'BANK' | 'PETTY_CASH',
  referenceNumber: '',
};

export default function InvoicesPage() {
  const query = useInvoices();
  const metaQuery = useSalesMeta();
  const branchesQuery = useAuthorizedBranches();
  const request = useSalesRequest();
  const recordPayment = useRecordPayment();
  const queryClient = useQueryClient();
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [isReceiptDrawerOpen, setIsReceiptDrawerOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(initialInvoiceForm);
  const [receiptForm, setReceiptForm] = useState(initialReceiptForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiptSubmitMode, setReceiptSubmitMode] = useState<'save' | 'print'>('save');
  const [receiptContext, setReceiptContext] = useState<InvoiceListItem | null>(null);
  const itemOptionsQuery = useItemSelectorOptions({
    branchId: invoiceForm.branchId || undefined,
    customerId: invoiceForm.customerId || undefined,
    includePrice: true,
    includeStock: true,
    limit: 250,
    warehouseId: invoiceForm.warehouseId || undefined,
  });
  const branchOptions = useMemo(() => branchesQuery.data ?? [], [branchesQuery.data]);
  const warehouseOptions = useMemo(
    () => (metaQuery.data?.warehouses ?? []).filter((warehouse) => !invoiceForm.branchId || warehouse.branchId === invoiceForm.branchId),
    [invoiceForm.branchId, metaQuery.data?.warehouses],
  );
  const receiptBranchId = receiptContext?.branchId ?? null;
  const bankAccountOptions = useMemo(
    () => (metaQuery.data?.bankAccounts ?? []).map((account) => ({
      id: String(account.id ?? ''),
      label: [
        String(account.accountName ?? '').trim(),
        String(account.bankName ?? '').trim(),
        String(account.accountNumber ?? '').trim(),
      ].filter(Boolean).join(' • '),
    })),
    [metaQuery.data?.bankAccounts],
  );
  const cashAccountOptions = useMemo(
    () =>
      (metaQuery.data?.cashAccounts ?? [])
        .filter((account) => !receiptBranchId || String(account.branchId ?? '') === String(receiptBranchId))
        .map((account) => ({
          id: String(account.id ?? ''),
          label: String(account.name ?? 'Cash account'),
        })),
    [metaQuery.data?.cashAccounts, receiptBranchId],
  );

  useEffect(() => {
    if (branchOptions.length !== 1) return;
    const onlyBranch = branchOptions[0];
    setInvoiceForm((current) => {
      if (current.branchId === onlyBranch.id && current.warehouseId) return current;
      return {
        ...current,
        branchId: onlyBranch.id,
        warehouseId: current.warehouseId || onlyBranch.defaultWarehouseId || '',
      };
    });
  }, [branchOptions]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    await queryClient.invalidateQueries({ queryKey: ['invoices'] });
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
  }

  async function handleInvoiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = normalizeSalesLines(invoiceForm.items);

    if (!invoiceForm.customerId) {
      setFormError('Customer is required.');
      return;
    }

    if (!invoiceForm.salesOrderId && (!invoiceForm.warehouseId || !lines.length)) {
      setFormError('Direct invoices require a warehouse and at least one item.');
      return;
    }
    if (!invoiceForm.salesOrderId) {
      const overdrawnLine = lines.find((line) => {
        const selectedOption = itemOptionsQuery.data?.find((item) => item.id === line.itemId);
        if (!selectedOption?.hasStockRecord) return true;
        const availableQuantity = Number(selectedOption.quantityAvailable ?? selectedOption.warehouseQuantity ?? 0);
        return Number(line.quantity) > availableQuantity;
      });
      if (overdrawnLine) {
        setFormError('Direct invoice quantity exceeds live available warehouse stock, or the selected item has no stock record.');
        return;
      }
    }

    try {
      await request(API_ROUTES.SALES.INVOICES, {
        body: JSON.stringify({
          branchId: invoiceForm.branchId || undefined,
          customerId: invoiceForm.customerId,
          discountAmount: Number(invoiceForm.discountAmount || 0),
          dueDate: invoiceForm.dueDate || null,
          invoiceDate: invoiceForm.invoiceDate || null,
          items: invoiceForm.salesOrderId ? undefined : lines,
          notes: invoiceForm.notes || null,
          postInventory: true,
          salesOrderId: invoiceForm.salesOrderId || undefined,
          taxAmount: Number(invoiceForm.taxAmount || 0),
          warehouseId: invoiceForm.warehouseId || undefined,
        }),
        method: 'POST',
      });
      setInvoiceForm(initialInvoiceForm);
      setFormError(null);
      setIsInvoiceDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create invoice.');
    }
  }

  async function approveInvoice(id: string) {
    await request(API_ROUTES.SALES.INVOICE_APPROVE(id), { body: JSON.stringify({}), method: 'POST' });
    await refresh();
  }

  function openInvoicePreview(id: string) {
    window.open(`/sales/invoices/${id}`, '_blank', 'noopener,noreferrer');
  }

  function openReceiptPrintPreview(payment: RecordPaymentResponse['payment']) {
    const printUrl = buildSalesReceiptPrintUrl(
      { paymentId: String(payment.id) },
      { autoPrint: true },
    );
    window.open(printUrl, '_blank', 'noopener,noreferrer');
  }

  function openReceiptDrawer(row: InvoiceListItem) {
    setReceiptContext(row);
    setReceiptForm({
      ...initialReceiptForm,
      amount: String(row.balanceDue),
      customerId: row.customer?.id ?? '',
      invoiceId: row.id,
    });
    setFormError(null);
    setIsReceiptDrawerOpen(true);
  }

  async function handleReceiptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await recordPayment.mutateAsync({
        amount: Number(receiptForm.amount),
        customerId: receiptForm.customerId,
        invoiceId: receiptForm.invoiceId,
        notes: receiptForm.notes || undefined,
        paymentDate: receiptForm.paymentDate,
        paymentMethod: receiptForm.paymentMethod,
        referenceNumber: receiptForm.referenceNumber || undefined,
        bankAccountId: receiptForm.paymentMethod === 'BANK' ? receiptForm.bankAccountId || undefined : undefined,
        cashAccountId: receiptForm.paymentMethod === 'BANK' ? undefined : receiptForm.cashAccountId || undefined,
      });
      await maybePrintReceipt(response);
      setReceiptForm(initialReceiptForm);
      setReceiptContext(null);
      setFormError(null);
      setIsReceiptDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to record receipt.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Invoices unavailable" description={query.error?.message ?? 'No invoice data returned.'} />;
  }

  const rows = query.data.data;
  const outstanding = rows.reduce((sum, row) => sum + row.balanceDue, 0);
  const overdue = rows
    .filter((row) => row.balanceDue > 0 && row.dueDate && new Date(row.dueDate).getTime() < Date.now())
    .reduce((sum, row) => sum + row.balanceDue, 0);
  const collected = rows.reduce((sum, row) => sum + row.amountPaid, 0);

  async function maybePrintReceipt(response: RecordPaymentResponse) {
    if (receiptSubmitMode !== 'print') return;

    const payment = response.payment;
    openReceiptPrintPreview(payment);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Track billing, collections, due dates, and invoice settlement status."
        actions={
          <Button type="button" size="sm" onClick={() => setIsInvoiceDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatCard title="Outstanding" value={currency.format(outstanding)} icon={<WalletCards className="h-5 w-5" />} />
        <StatCard title="Overdue" value={currency.format(overdue)} icon={<AlertCircle className="h-5 w-5" />} color="warning" />
        <StatCard title="Collected" value={currency.format(collected)} icon={<ReceiptText className="h-5 w-5" />} color="success" />
      </div>
      <DataTable
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'invoiceDate', header: 'Invoice Date' },
          {
            key: 'customer',
            header: 'Customer',
            render: (row) => row.customer?.name ?? 'Unassigned',
          },
          { key: 'itemsCount', header: 'Items' },
          { key: 'total', header: 'Total', render: (row) => currency.format(row.total), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'amountPaid', header: 'Paid', render: (row) => currency.format(row.amountPaid), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'balanceDue', header: 'Balance', render: (row) => currency.format(row.balanceDue), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'dueDate', header: 'Due Date', render: (row) => row.dueDate ?? 'Not set' },
          { key: 'status', header: 'Status' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const status = row.status.toLowerCase();
              return (
                <div className="flex flex-wrap gap-2">
                  {!['approved', 'posted', 'partially_paid', 'paid', 'cancelled', 'fully_dispatched'].includes(status) ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => approveInvoice(row.id)}>
                      Approve/Reserve
                    </Button>
                  ) : null}
                  {!['draft', 'cancelled', 'voided', 'reversed'].includes(status) ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => openInvoicePreview(row.id)}>
                      Preview / Print
                    </Button>
                  ) : null}
                  {row.balanceDue > 0 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => openReceiptDrawer(row)}>
                      Receipt
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ]}
        data={rows}
        pagination={query.data.pagination}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No invoices found" description="Approved orders and direct invoices will appear here." />}
      />
      <FormDrawer title="New Invoice" open={isInvoiceDrawerOpen} onClose={() => setIsInvoiceDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleInvoiceSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Sales order</span>
            <select className="surface-input-soft" value={invoiceForm.salesOrderId} onChange={(event) => {
              const order = metaQuery.data?.salesOrders.find((row) => row.id === event.target.value);
              setInvoiceForm((current) => ({
                ...current,
                branchId: order?.branchId ?? current.branchId,
                customerId: order?.customerId ?? current.customerId,
                salesOrderId: event.target.value,
                warehouseId: order?.warehouseId ?? current.warehouseId,
              }));
            }}>
              <option value="">Direct invoice / no order</option>
              {metaQuery.data?.salesOrders.filter((order) => ['confirmed', 'approved', 'dispatched'].includes(order.status.toLowerCase())).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} - {currency.format(order.total)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            {!invoiceForm.salesOrderId ? (
              <label className="space-y-2 text-sm text-muted">
                <span>Branch</span>
                <select className="surface-input-soft" required value={invoiceForm.branchId} onChange={(event) => {
                  const branch = branchOptions.find((row) => row.id === event.target.value);
                  setInvoiceForm((current) => ({
                    ...current,
                    branchId: event.target.value,
                    warehouseId: branch?.defaultWarehouseId ?? '',
                  }));
                }}>
                  <option value="">Select branch</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code ? `${branch.code} - ` : ''}
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="space-y-2 text-sm text-muted">
              <span>Customer</span>
              <select className="surface-input-soft" required value={invoiceForm.customerId} onChange={(event) => setInvoiceForm((current) => ({ ...current, customerId: event.target.value }))}>
                <option value="">Select customer</option>
                {metaQuery.data?.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code ? `${customer.code} - ` : ''}
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Warehouse</span>
              <select className="surface-input-soft" value={invoiceForm.warehouseId} onChange={(event) => setInvoiceForm((current) => ({ ...current, warehouseId: event.target.value }))}>
                <option value="">Select warehouse</option>
                {warehouseOptions.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code ? `${warehouse.code} - ` : ''}
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Invoice date</span>
              <input className="surface-input-soft" type="date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Due date</span>
              <input className="surface-input-soft" type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </label>
          </div>
          {!invoiceForm.salesOrderId ? (
            <SalesLineItemsEditor
              items={itemOptionsQuery.data ?? []}
              loading={itemOptionsQuery.isLoading}
              errorMessage={itemOptionsQuery.error?.message ?? null}
              emptyMessage="No invoice items are available for the selected warehouse."
              onRetry={() => itemOptionsQuery.refetch()}
              lines={invoiceForm.items}
              onChange={(items) => setInvoiceForm((current) => ({ ...current, items }))}
            />
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Discount amount</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={invoiceForm.discountAmount} onChange={(event) => setInvoiceForm((current) => ({ ...current, discountAmount: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Tax amount</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={invoiceForm.taxAmount} onChange={(event) => setInvoiceForm((current) => ({ ...current, taxAmount: event.target.value }))} />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea className="surface-textarea-soft" rows={3} value={invoiceForm.notes} onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsInvoiceDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Invoice</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer title="Record Receipt" open={isReceiptDrawerOpen} onClose={() => setIsReceiptDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleReceiptSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          {receiptContext ? (
            <div className="rounded-3xl border border-border/70 bg-[linear-gradient(135deg,rgba(255,247,232,0.96),rgba(255,255,255,0.92))] px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Customer</p>
                  <p className="mt-1 text-sm font-medium text-brown">{receiptContext.customer?.name ?? 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Invoice</p>
                  <p className="mt-1 text-sm font-medium text-brown">{receiptContext.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Outstanding Balance</p>
                  <p className="mt-1 text-sm font-medium text-brown">{currency.format(receiptContext.balanceDue)}</p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Receipt date</span>
              <input className="surface-input-soft" required type="date" value={receiptForm.paymentDate} onChange={(event) => {
                setFormError(null);
                setReceiptForm((current) => ({ ...current, paymentDate: event.target.value }));
              }} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Amount</span>
              <input className="surface-input-soft" min="0.01" step="0.01" type="number" value={receiptForm.amount} onChange={(event) => {
                setFormError(null);
                setReceiptForm((current) => ({ ...current, amount: event.target.value }));
              }} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Source of payment</span>
              <select className="surface-input-soft" value={receiptForm.paymentMethod} onChange={(event) => {
                setFormError(null);
                setReceiptForm((current) => ({
                  ...current,
                  bankAccountId: '',
                  cashAccountId: '',
                  paymentMethod: event.target.value as typeof current.paymentMethod,
                }));
              }}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="PETTY_CASH">Petty cash</option>
              </select>
            </label>
            {receiptForm.paymentMethod === 'BANK' ? (
              <label className="space-y-2 text-sm text-muted">
                <span>Bank account</span>
                <select className="surface-input-soft" required value={receiptForm.bankAccountId} onChange={(event) => {
                  setFormError(null);
                  setReceiptForm((current) => ({ ...current, bankAccountId: event.target.value }));
                }}>
                  <option value="">{metaQuery.isLoading ? 'Loading bank accounts...' : 'Select bank account'}</option>
                  {bankAccountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-2 text-sm text-muted">
                <span>{receiptForm.paymentMethod === 'PETTY_CASH' ? 'Petty cash account' : 'Cash account'}</span>
                <select className="surface-input-soft" required value={receiptForm.cashAccountId} onChange={(event) => {
                  setFormError(null);
                  setReceiptForm((current) => ({ ...current, cashAccountId: event.target.value }));
                }}>
                  <option value="">{metaQuery.isLoading ? 'Loading cash accounts...' : 'Select cash account'}</option>
                  {cashAccountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="space-y-2 text-sm text-muted">
              <span>Reference</span>
              <input className="surface-input-soft" value={receiptForm.referenceNumber} onChange={(event) => {
                setFormError(null);
                setReceiptForm((current) => ({ ...current, referenceNumber: event.target.value }));
              }} />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea className="surface-textarea-soft" rows={3} value={receiptForm.notes} onChange={(event) => {
              setFormError(null);
              setReceiptForm((current) => ({ ...current, notes: event.target.value }));
            }} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsReceiptDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={recordPayment.isPending} onClick={() => setReceiptSubmitMode('save')}>
              {recordPayment.isPending && receiptSubmitMode === 'save' ? 'Saving...' : 'Save'}
            </Button>
            <Button type="submit" variant="secondary" disabled={recordPayment.isPending} onClick={() => setReceiptSubmitMode('print')}>
              {recordPayment.isPending && receiptSubmitMode === 'print' ? 'Saving & opening print...' : 'Save & Print Receipt'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
