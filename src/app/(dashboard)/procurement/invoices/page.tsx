'use client';

import { Plus, ReceiptText } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
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
  purchaseOrderId: '',
  supplierId: '',
};

export default function ProcurementInvoicesPage() {
  const canCreate = usePermission([PERMISSIONS.invoice.create, 'procurement.write', 'finance.write']);
  const query = useSupplierInvoices();
  const metaQuery = useProcurementMeta();
  const grnsQuery = useGRNs({ page: 1, pageSize: 100 });
  const request = useProcurementRequest();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [lineItems, setLineItems] = useState([
    { itemId: '', poUnitCost: '0', quantityInvoiced: '1', unitCost: '0' }
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const orderQuery = usePurchaseOrder(formState.purchaseOrderId || undefined);

  useEffect(() => {
    const order = orderQuery.data as
      | {
          items: Array<{
            item: { id: string };
            quantityOrdered: number;
            unitCost: number;
          }>;
          supplier: { id: string };
        }
      | undefined;

    if (!order) return;

    setFormState((current) => ({
      ...current,
      supplierId: order.supplier.id,
    }));
    setLineItems(
      order.items.map((item) => ({
        itemId: item.item.id,
        poUnitCost: String(item.unitCost),
        quantityInvoiced: String(item.quantityOrdered),
        unitCost: String(item.unitCost),
      })),
    );
  }, [orderQuery.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    try {
      await request('/api/procurement/supplier-invoices', {
        body: JSON.stringify({
          dueDate: formState.dueDate || null,
          goodsReceivedNoteId: formState.goodsReceivedNoteId || null,
          invoiceDate: formState.invoiceDate || null,
          invoiceNumber: formState.invoiceNumber,
          items,
          purchaseOrderId: formState.purchaseOrderId || null,
          supplierId: formState.supplierId,
        }),
        method: 'POST',
      });

      setFormError(null);
      setFormState(initialFormState);
      setLineItems([{ itemId: '', poUnitCost: '0', quantityInvoiced: '1', unitCost: '0' }]);
      setIsDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['procurement'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create supplier invoice.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Invoices"
        description="Track invoice totals, balances, purchase order references, and payment exposure for suppliers."
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
      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'supplierName', header: 'Supplier' },
          { key: 'purchaseOrderNumber', header: 'PO #' },
          { key: 'invoiceDate', header: 'Invoice Date' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'total', header: 'Total', render: (row) => currencyFormatter.format(row.total) },
          { key: 'paidAmount', header: 'Paid', render: (row) => currencyFormatter.format(row.paidAmount) },
          { key: 'balance', header: 'Balance', render: (row) => currencyFormatter.format(row.balance) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        ]}
        emptyState={<EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No supplier invoices found" description="Supplier invoices will appear here once recorded against purchase orders or GRNs." />}
      />

      <FormDrawer title="New Supplier Invoice" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Supplier</span>
              <select
                required
                value={formState.supplierId}
                onChange={(event) => setFormState((current) => ({ ...current, supplierId: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">Select supplier</option>
                {(metaQuery.data?.suppliers ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Order</span>
              <select
                value={formState.purchaseOrderId}
                onChange={(event) => setFormState((current) => ({ ...current, purchaseOrderId: event.target.value }))}
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
                onChange={(event) => setFormState((current) => ({ ...current, goodsReceivedNoteId: event.target.value }))}
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
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Invoice Line Items</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLineItems((current) => [
                    ...current,
                    { itemId: '', poUnitCost: '0', quantityInvoiced: '1', unitCost: '0' }
                  ])
                }
              >
                Add Item
              </Button>
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
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Invoice</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
