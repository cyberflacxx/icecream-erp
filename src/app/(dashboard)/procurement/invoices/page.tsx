'use client';

import { Plus, ReceiptText } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { SupplierSelect } from '@/components/procurement/supplier-select';
import { TransactionShortcuts } from '@/components/procurement/transaction-shortcuts';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, StatusBadge } from '@/components/ui-library';
import { useGRNs, useProcurementMeta, useProcurementRequest, usePurchaseOrder, useSupplierInvoices } from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const initialFormState = {
  dueDate: '',
  goodsReceivedNoteId: '',
  invoiceDate: '',
  invoiceNumber: '',
  notes: '',
  attachmentName: '',
  purchaseOrderId: '',
  supplierId: '',
};

type InvoiceLine = {
  itemId: string;
  orderedQuantity?: number;
  poUnitCost: string;
  quantityInvoiced: string;
  receivedQuantity?: number;
  unitCost: string;
};

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

export default function ProcurementInvoicesPage() {
  const canCreate = usePermission([PERMISSIONS.invoice.create, 'procurement.write', 'finance.write']);
  const canPost = usePermission(['procurement.invoice.post', 'finance.write', 'procurement.write']);
  const query = useSupplierInvoices();
  const metaQuery = useProcurementMeta();
  const grnsQuery = useGRNs({ page: 1, pageSize: 100 });
  const request = useProcurementRequest();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [lineItems, setLineItems] = useState<InvoiceLine[]>([
    { itemId: '', poUnitCost: '0', quantityInvoiced: '1', unitCost: '0' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const orderQuery = usePurchaseOrder(formState.purchaseOrderId || undefined);

  const selectedOrder = useMemo(
    () => (metaQuery.data?.purchaseOrders ?? []).find((order) => order.id === formState.purchaseOrderId) ?? null,
    [formState.purchaseOrderId, metaQuery.data?.purchaseOrders],
  );
  const selectedGrn = useMemo(
    () => (grnsQuery.data?.data ?? []).find((grn) => grn.id === formState.goodsReceivedNoteId) ?? null,
    [formState.goodsReceivedNoteId, grnsQuery.data?.data],
  );
  const poItems = useMemo(() => {
    const order = orderQuery.data as
      | {
          items?: Array<{
            id: string;
            item: { id: string; name?: string | null } | null;
            quantityOrdered: number;
            quantityReceived: number;
            unitCost: number;
          }>;
        }
      | undefined;
    return order?.items ?? [];
  }, [orderQuery.data]);
  const invoicedQuantityByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lineItems) {
      if (!line.itemId) continue;
      map.set(line.itemId, (map.get(line.itemId) ?? 0) + Number(line.quantityInvoiced ?? 0));
    }
    return map;
  }, [lineItems]);
  const invoiceTotals = useMemo(() => {
    return lineItems.reduce(
      (totals, line) => {
        const quantity = Number(line.quantityInvoiced || 0);
        const invoiceCost = Number(line.unitCost || 0);
        const poCost = Number(line.poUnitCost || 0);
        const lineTotal = quantity * invoiceCost;

        totals.quantity += Number.isFinite(quantity) ? quantity : 0;
        totals.subtotal += Number.isFinite(lineTotal) ? lineTotal : 0;
        totals.variance += Number.isFinite(quantity * (invoiceCost - poCost)) ? quantity * (invoiceCost - poCost) : 0;
        return totals;
      },
      { quantity: 0, subtotal: 0, variance: 0 },
    );
  }, [lineItems]);

  useEffect(() => {
    const order = orderQuery.data as
      | {
          items: Array<{
            item: { id: string } | null;
            quantityOrdered: number;
            quantityReceived?: number;
            unitCost: number;
          }>;
          supplier: { id: string } | null;
        }
      | undefined;

    if (!order) return;

    setFormState((current) => ({
      ...current,
      supplierId: order.supplier?.id ?? current.supplierId,
    }));
    setLineItems(
      order.items.map((item) => ({
        itemId: item.item?.id ?? '',
        orderedQuantity: item.quantityOrdered,
        poUnitCost: String(item.unitCost),
        quantityInvoiced: String(item.quantityOrdered),
        receivedQuantity: item.quantityReceived,
        unitCost: String(item.unitCost),
      })),
    );
  }, [orderQuery.data]);

  async function runAction(actionKey: string, successMessage: string, task: () => Promise<void>) {
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await task();
      setFeedback({ message: successMessage, tone: 'success' });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Supplier invoice action failed.',
        tone: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const items = lineItems
      .filter((item) => item.itemId)
      .map((item) => ({
        itemId: item.itemId,
        poUnitCost: Number(item.poUnitCost),
        quantityInvoiced: Number(item.quantityInvoiced),
        unitCost: Number(item.unitCost),
      }));

    if (!formState.supplierId || !formState.invoiceNumber || !items.length) {
      setFormError('Supplier, invoice number, and at least one line item are required.');
      return;
    }

    if (
      items.some(
        (item) =>
          Number.isNaN(item.quantityInvoiced) ||
          Number.isNaN(item.unitCost) ||
          Number.isNaN(item.poUnitCost) ||
          item.quantityInvoiced <= 0 ||
          item.unitCost < 0 ||
          item.poUnitCost < 0,
      )
    ) {
      setFormError('Invoice quantities must be above zero and costs cannot be negative.');
      return;
    }

    try {
      await request('/api/procurement/supplier-invoices', {
        body: JSON.stringify({
          dueDate: formState.dueDate || null,
          goodsReceivedNoteId: formState.goodsReceivedNoteId || null,
          invoiceDate: formState.invoiceDate || null,
          invoiceNumber: formState.invoiceNumber,
          items,
          notes: formState.notes || null,
          purchaseOrderId: formState.purchaseOrderId || null,
          supplierId: formState.supplierId,
        }),
        method: 'POST',
      });

      setFormError(null);
      setFormState(initialFormState);
      setLineItems([{ itemId: '', poUnitCost: '0', quantityInvoiced: '1', unitCost: '0' }]);
      setIsDrawerOpen(false);
      setFeedback({ message: 'Supplier invoice recorded.', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['procurement'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create supplier invoice.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Invoices"
        description="Track supplier invoice capture, tie each invoice back to the PO or GRN, and hand over clean balances to procurement payments."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
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

      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'supplierName', header: 'Supplier' },
          {
            key: 'links',
            header: 'Linked Documents',
            render: (row) => (
              <div className="space-y-1 text-sm">
                <p>{row.purchaseOrderNumber ? `PO ${row.purchaseOrderNumber}` : 'No PO link'}</p>
                <p className="text-xs text-muted">
                  {row.goodsReceivedNoteNumber ? `GRN ${row.goodsReceivedNoteNumber}` : 'No GRN link'}
                </p>
              </div>
            ),
          },
          { key: 'invoiceDate', header: 'Invoice Date' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'total', header: 'Total', render: (row) => currencyFormatter.format(row.total) },
          { key: 'paidAmount', header: 'Paid', render: (row) => currencyFormatter.format(row.paidAmount) },
          { key: 'balance', header: 'Balance', render: (row) => currencyFormatter.format(row.balance) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {canPost && row.status !== 'POSTED' && row.status !== 'PAID' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `post:${row.id}`}
                    onClick={() =>
                      void runAction(`post:${row.id}`, 'Supplier invoice posted to finance.', async () => {
                        await request(`/api/procurement/supplier-invoices/${row.id}/post`, {
                          body: JSON.stringify({}),
                          method: 'POST',
                        });
                        await queryClient.invalidateQueries({ queryKey: ['procurement'] });
                      })
                    }
                  >
                    {pendingAction === `post:${row.id}` ? 'Posting...' : 'Post Invoice'}
                  </Button>
                ) : null}
                {row.balance > 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`/procurement/payments?invoiceId=${row.id}`}>Pay Invoice</a>
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
        emptyState={
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" />}
            title="No supplier invoices found"
            description="Supplier invoices will appear here once recorded against purchase orders or GRNs."
          />
        }
      />

      <FormDrawer title="New Supplier Invoice" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Invoice Info</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Supplier</span>
              <SupplierSelect
                required
                value={formState.supplierId}
                onChange={(supplierId) => setFormState((current) => ({ ...current, supplierId }))}
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Invoice Number</span>
              <input
                required
                value={formState.invoiceNumber}
                onChange={(event) => setFormState((current) => ({ ...current, invoiceNumber: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Invoice Date</span>
              <input
                type="date"
                value={formState.invoiceDate}
                onChange={(event) => setFormState((current) => ({ ...current, invoiceDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Due Date</span>
              <input
                type="date"
                value={formState.dueDate}
                onChange={(event) => setFormState((current) => ({ ...current, dueDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <div className="space-y-2 text-sm text-muted">
              <span>Quick Actions</span>
              <TransactionShortcuts
                onSupplierCreated={(supplier) =>
                  setFormState((current) => ({ ...current, supplierId: supplier.id }))
                }
                onItemCreated={(createdItem) =>
                  setLineItems((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === current.length - 1 && !row.itemId
                        ? {
                            ...row,
                            itemId: createdItem.id,
                            poUnitCost: String(createdItem.unitCost ?? 0),
                            unitCost: String(createdItem.unitCost ?? 0),
                          }
                        : row,
                    ),
                  )
                }
              />
            </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Billing / Delivery Context</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Order</span>
              <select
                value={formState.purchaseOrderId}
                onChange={(event) =>
                  setFormState((current) => {
                    const purchaseOrderId = event.target.value;
                    const order = (metaQuery.data?.purchaseOrders ?? []).find((candidate) => candidate.id === purchaseOrderId) ?? null;
                    return {
                      ...current,
                      purchaseOrderId,
                      supplierId: order?.supplier?.id ?? current.supplierId,
                    };
                  })
                }
                className="surface-input-soft"
              >
                <option value="">Optional PO link</option>
                {(metaQuery.data?.purchaseOrders ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.poNumber} - {order.supplier?.name ?? 'Unknown supplier'}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>GRN</span>
              <select
                value={formState.goodsReceivedNoteId}
                onChange={(event) =>
                  setFormState((current) => {
                    const goodsReceivedNoteId = event.target.value;
                    const grn = (grnsQuery.data?.data ?? []).find((candidate) => candidate.id === goodsReceivedNoteId) ?? null;
                    return {
                      ...current,
                      goodsReceivedNoteId,
                      purchaseOrderId: grn?.purchaseOrder?.id ?? current.purchaseOrderId,
                      supplierId: grn?.supplier?.id ?? current.supplierId,
                    };
                  })
                }
                className="surface-input-soft"
              >
                <option value="">Optional GRN link</option>
                {(grnsQuery.data?.data ?? []).map((grn) => (
                  <option key={grn.id} value={grn.id}>
                    {grn.grnNumber} - {grn.supplier?.name ?? 'Unknown supplier'}
                  </option>
                ))}
              </select>
            </label>
            </div>
          </section>

          {(selectedOrder || selectedGrn) ? (
            <section className="grid gap-3 sm:grid-cols-2">
              {selectedOrder ? (
                <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Linked Purchase Order</p>
                  <p className="mt-2 text-brown">{selectedOrder.poNumber}</p>
                  <p className="mt-1">{selectedOrder.supplier?.name ?? 'Unknown supplier'}</p>
                </div>
              ) : null}
              {selectedGrn ? (
                <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Linked GRN</p>
                  <p className="mt-2 text-brown">{selectedGrn.grnNumber}</p>
                  <p className="mt-1">{selectedGrn.purchaseOrder?.poNumber ?? 'Manual receipt'}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Invoice Lines</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLineItems((current) => [
                    ...current,
                    { itemId: '', poUnitCost: '0', quantityInvoiced: '1', unitCost: '0' },
                  ])
                }
              >
                Add Item
              </Button>
            </div>
            <div className="hidden gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted md:grid md:grid-cols-[1fr_120px_120px_120px_auto]">
              <span>Item</span>
              <span>Qty</span>
              <span>Invoice Cost</span>
              <span>PO Cost</span>
              <span>Action</span>
            </div>
            {lineItems.map((item, index) => (
              <div key={`${item.itemId}-${index}`} className="grid gap-3 md:grid-cols-[1fr_120px_120px_120px_auto]">
                <select
                  value={item.itemId}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, itemId: event.target.value } : row,
                      ),
                    )
                  }
                  className="surface-input-soft"
                >
                  <option value="">Select item</option>
                  {(metaQuery.data?.items ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} - {row.name}
                    </option>
                  ))}
                </select>
                <input
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={item.quantityInvoiced}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, quantityInvoiced: event.target.value } : row,
                      ),
                    )
                  }
                  className="surface-input-soft"
                />
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.unitCost}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unitCost: event.target.value } : row,
                      ),
                    )
                  }
                  className="surface-input-soft"
                  placeholder="Invoice cost"
                />
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.poUnitCost}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, poUnitCost: event.target.value } : row,
                      ),
                    )
                  }
                  className="surface-input-soft"
                  placeholder="PO cost"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setLineItems((current) =>
                      current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                >
                  Remove
                </Button>
                {item.itemId ? (
                  <div className="rounded-2xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted md:col-span-5">
                    {(() => {
                      const poLine = poItems.find((candidate) => candidate.item?.id === item.itemId);
                      const ordered = Number(item.orderedQuantity ?? poLine?.quantityOrdered ?? 0);
                      const received = Number(item.receivedQuantity ?? poLine?.quantityReceived ?? 0);
                      const invoiced = Number(invoicedQuantityByItem.get(item.itemId) ?? 0);
                      const outstanding = Math.max(0, ordered - invoiced);
                      return `Ordered: ${ordered.toFixed(3)} • Received: ${received.toFixed(3)} • Invoiced: ${invoiced.toFixed(3)} • Outstanding: ${outstanding.toFixed(3)}`;
                    })()}
                  </div>
                ) : null}
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Totals</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Quantity</p>
                <p className="mt-1 font-semibold text-brown">{invoiceTotals.quantity.toFixed(3)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Subtotal</p>
                <p className="mt-1 font-semibold text-brown">{currencyFormatter.format(invoiceTotals.subtotal)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Cost Variance</p>
                <p className="mt-1 font-semibold text-brown">{currencyFormatter.format(invoiceTotals.variance)}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Notes / Attachments</p>
            <label className="space-y-2 text-sm text-muted">
              <span>Notes</span>
              <textarea
                rows={3}
                value={formState.notes}
                onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                className="surface-textarea-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Attachment Reference</span>
              <input
                value={formState.attachmentName}
                onChange={(event) => setFormState((current) => ({ ...current, attachmentName: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
          </section>

          <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 border-t border-border/70 bg-white/95 px-1 py-4 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pendingAction === 'create'}>
              Save Invoice
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
