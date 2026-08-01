'use client';

import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { createSalesLineDraft, normalizeSalesLines, SalesLineItemsEditor, type SalesLineDraft } from '@/components/sales/sales-line-items-editor';
import { Button } from '@/components/ui/button';
import { useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useCreateSalesOrder } from '@/hooks/sales/useCreateSalesOrder';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { type SalesOrderListItem, useSalesOrders } from '@/hooks/sales/useSalesOrders';
import { useSalesRequest } from '@/hooks/sales/useSalesRequest';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

const initialOrderForm = {
  branchId: '',
  customerId: '',
  discountAmount: '0',
  items: [createSalesLineDraft()],
  notes: '',
  orderDate: new Date().toISOString().slice(0, 10),
  requiredDate: '',
  taxAmount: '0',
  warehouseId: '',
};

function validSalesLines(lines: SalesLineDraft[]) {
  const normalized = normalizeSalesLines(lines);
  return normalized.length > 0 && normalized.every((item) => item.quantity > 0 && item.unitPrice >= 0 && Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice));
}

export default function SalesOrdersPage() {
  const query = useSalesOrders();
  const metaQuery = useSalesMeta();
  const createOrder = useCreateSalesOrder();
  const request = useSalesRequest();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialOrderForm);
  const [formError, setFormError] = useState<string | null>(null);
  const itemOptionsQuery = useItemSelectorOptions({
    branchId: formState.branchId || undefined,
    includePrice: true,
    includeStock: true,
    warehouseId: formState.warehouseId || undefined,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    await queryClient.invalidateQueries({ queryKey: ['invoices'] });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = normalizeSalesLines(formState.items);

    if (!formState.customerId || !formState.warehouseId) {
      setFormError('Customer and warehouse are required.');
      return;
    }

    if (!validSalesLines(formState.items)) {
      setFormError('Add at least one ordered item with quantity greater than zero.');
      return;
    }

    try {
      await createOrder.mutateAsync({
        branchId: formState.branchId || undefined,
        customerId: formState.customerId,
        discountAmount: Number(formState.discountAmount || 0),
        items: lines.map((line) => ({
          discountPercent: line.discountPercent,
          itemId: line.itemId,
          quantityOrdered: line.quantity,
          unitPrice: line.unitPrice,
        })),
        notes: formState.notes || null,
        orderDate: formState.orderDate || null,
        requiredDate: formState.requiredDate || null,
        taxAmount: Number(formState.taxAmount || 0),
        warehouseId: formState.warehouseId,
      });
      setFormState(initialOrderForm);
      setFormError(null);
      setIsDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create sales order.');
    }
  }

  async function confirmOrder(id: string) {
    await request(API_ROUTES.SALES.SALES_ORDER_CONFIRM(id), { body: JSON.stringify({}), method: 'POST' });
    await refresh();
  }

  async function createInvoice(row: SalesOrderListItem) {
    if (!row.customer?.id) return;
    await request(API_ROUTES.SALES.INVOICES, {
      body: JSON.stringify({
        customerId: row.customer.id,
        discountAmount: 0,
        invoiceDate: new Date().toISOString().slice(0, 10),
        salesOrderId: row.id,
        taxAmount: 0,
      }),
      method: 'POST',
    });
    await refresh();
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Sales orders unavailable" description={query.error?.message ?? 'No sales orders returned.'} />;
  }

  const rows = query.data.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sales Orders"
        description="Track order intake, approvals, required dates, and commercial value."
        actions={
          <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'orderNumber', header: 'Order #' },
          { key: 'orderDate', header: 'Order Date' },
          {
            key: 'customer',
            header: 'Customer',
            render: (row) => row.customer?.name ?? 'Unassigned',
          },
          { key: 'requiredDate', header: 'Required Date', render: (row) => row.requiredDate ?? 'Not set' },
          { key: 'itemsCount', header: 'Items' },
          { key: 'total', header: 'Total', render: (row) => currency.format(row.total), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'status', header: 'Status' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const status = row.status.toLowerCase();
              return (
                <div className="flex flex-wrap gap-2">
                  {status === 'draft' ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => confirmOrder(row.id)}>
                      Confirm
                    </Button>
                  ) : null}
                  {!['cancelled', 'invoiced'].includes(status) ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => createInvoice(row)}>
                      Create Invoice
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ]}
        data={rows}
        pagination={query.data.pagination}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No sales orders found" description="Approved quotations and new customer demand will appear here." />}
      />
      <FormDrawer title="New Sales Order" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Customer</span>
              <select className="surface-input-soft" required value={formState.customerId} onChange={(event) => setFormState((current) => ({ ...current, customerId: event.target.value }))}>
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
              <select className="surface-input-soft" required value={formState.warehouseId} onChange={(event) => {
                const warehouse = metaQuery.data?.warehouses.find((row) => row.id === event.target.value);
                setFormState((current) => ({ ...current, branchId: warehouse?.branchId ?? '', warehouseId: event.target.value }));
              }}>
                <option value="">Select warehouse</option>
                {metaQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code ? `${warehouse.code} - ` : ''}
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Order date</span>
              <input className="surface-input-soft" type="date" value={formState.orderDate} onChange={(event) => setFormState((current) => ({ ...current, orderDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Required date</span>
              <input className="surface-input-soft" type="date" value={formState.requiredDate} onChange={(event) => setFormState((current) => ({ ...current, requiredDate: event.target.value }))} />
            </label>
          </div>
          <SalesLineItemsEditor
            items={itemOptionsQuery.data ?? []}
            loading={itemOptionsQuery.isLoading}
            errorMessage={itemOptionsQuery.error?.message ?? null}
            emptyMessage="No saleable items are available for the selected warehouse."
            lines={formState.items}
            onChange={(items) => setFormState((current) => ({ ...current, items }))}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Discount amount</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.discountAmount} onChange={(event) => setFormState((current) => ({ ...current, discountAmount: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Tax amount</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.taxAmount} onChange={(event) => setFormState((current) => ({ ...current, taxAmount: event.target.value }))} />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea className="surface-textarea-soft" rows={3} value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? 'Saving...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
