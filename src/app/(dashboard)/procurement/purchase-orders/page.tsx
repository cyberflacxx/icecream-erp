'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
import {
  useProcurementMeta,
  useProcurementRequest,
  usePurchaseOrders,
  type PurchaseOrderRow
} from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

const initialFormState = {
  discountAmount: '0',
  expectedDeliveryDate: '',
  items: [
    {
      itemId: '',
      quantityOrdered: '1',
      unitCost: '0',
      unitOfMeasureId: ''
    }
  ],
  notes: '',
  orderDate: '',
  requisitionId: '',
  supplierId: '',
  taxAmount: '0'
};

function statusVariant(status: string) {
  if (status === 'RECEIVED') {
    return 'success' as const;
  }

  if (status === 'PARTIAL_RECEIVED') {
    return 'warning' as const;
  }

  if (status === 'SENT') {
    return 'info' as const;
  }

  if (status === 'CANCELLED') {
    return 'error' as const;
  }

  return 'neutral' as const;
}

export default function PurchaseOrdersPage() {
  const searchParams = useSearchParams();
  const requisitionIdParam = searchParams.get('requisitionId');
  const canCreate = usePermission(PERMISSIONS.purchaseOrder.create);
  const canApprove = usePermission(PERMISSIONS.purchaseOrder.approve);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    status: '',
    supplierId: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState(initialFormState);

  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const metaQuery = useProcurementMeta();
  const ordersQuery = usePurchaseOrders({
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
    supplierId: filters.supplierId || undefined
  });

  useEffect(() => {
    if (!requisitionIdParam) {
      return;
    }

    setFormState((current) => ({
      ...current,
      requisitionId: requisitionIdParam
    }));
    setIsDrawerOpen(true);
  }, [requisitionIdParam]);

  const orders = ordersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.pagination;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = formState.items
      .filter((item) => item.itemId && item.unitOfMeasureId)
      .map((item) => ({
        itemId: item.itemId,
        quantityOrdered: Number(item.quantityOrdered),
        unitCost: Number(item.unitCost),
        unitOfMeasureId: item.unitOfMeasureId
      }));

    if (!formState.supplierId || !items.length) {
      setFormError('Supplier and at least one line item are required.');
      return;
    }

    if (
      items.some(
        (item) =>
          Number.isNaN(item.quantityOrdered) ||
          Number.isNaN(item.unitCost) ||
          item.quantityOrdered <= 0 ||
          item.unitCost < 0,
      )
    ) {
      setFormError('All quantities and unit costs must be valid positive values.');
      return;
    }

    try {
      await request('/api/procurement/purchase-orders', {
        body: JSON.stringify({
          discountAmount: Number(formState.discountAmount),
          expectedDeliveryDate: formState.expectedDeliveryDate || null,
          items,
          notes: formState.notes || null,
          orderDate: formState.orderDate || undefined,
          requisitionId: formState.requisitionId || null,
          supplierId: formState.supplierId,
          taxAmount: Number(formState.taxAmount)
        }),
        method: 'POST'
      });
      setFormError(null);
      setFormState(initialFormState);
      setIsDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create purchase order.');
    }
  }

  async function approveOrder(id: string) {
    await request(`/api/procurement/purchase-orders/${id}/approve`, {
      body: JSON.stringify({}),
      method: 'POST'
    });
    await refresh();
  }

  async function sendOrder(id: string) {
    await request(`/api/procurement/purchase-orders/${id}/send`, {
      body: JSON.stringify({}),
      method: 'POST'
    });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Convert approved demand into supplier orders and track dispatch and receiving progress."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          ) : null
        }
      />

      <ProcurementNav />

      <FilterBar
        filters={[
          {
            key: 'supplierId',
            label: 'Supplier',
            options: (metaQuery.data?.suppliers ?? []).map((supplier) => ({
              label: supplier.name,
              value: supplier.id
            })),
            type: 'select',
            value: filters.supplierId
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'DRAFT', value: 'DRAFT' },
              { label: 'SENT', value: 'SENT' },
              { label: 'PARTIAL_RECEIVED', value: 'PARTIAL_RECEIVED' },
              { label: 'RECEIVED', value: 'RECEIVED' },
              { label: 'CANCELLED', value: 'CANCELLED' }
            ],
            type: 'select',
            value: filters.status
          }
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
            page: 1
          }))
        }
      />

      <DataTable<PurchaseOrderRow>
        data={orders}
        loading={ordersQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'poNumber', header: 'PO #' },
          {
            key: 'supplier',
            header: 'Supplier',
            render: (row) => row.supplier.name
          },
          {
            key: 'orderDate',
            header: 'Order Date',
            render: (row) => new Date(row.orderDate).toLocaleDateString()
          },
          {
            key: 'expectedDeliveryDate',
            header: 'Expected Delivery',
            render: (row) =>
              row.expectedDeliveryDate
                ? new Date(row.expectedDeliveryDate).toLocaleDateString()
                : '-'
          },
          {
            key: 'itemsCount',
            header: 'Items',
            render: (row) => String(row.itemsCount)
          },
          {
            key: 'total',
            header: 'Total',
            render: (row) => currencyFormatter.format(row.total)
          },
          {
            key: 'status',
            header: 'Status Badge',
            render: (row) => <StatusBadge status={row.status} variant={statusVariant(row.status)} />
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const status = row.status;
              const id = row.id;

              if (status === 'DRAFT') {
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/procurement/purchase-orders/${id}`}>Edit</Link>
                    </Button>
                    {canApprove ? (
                      <Button size="sm" variant="outline" onClick={() => approveOrder(id)}>
                        Approve
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                );
              }

              if (status === 'SENT') {
                return (
                  <div className="flex flex-wrap gap-2">
                    {canApprove ? (
                      <Button size="sm" variant="outline" onClick={() => sendOrder(id)}>
                        Resend
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link href="/procurement/goods-received">Record GRN</Link>
                    </Button>
                  </div>
                );
              }

              return (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/procurement/purchase-orders/${id}`}>View</Link>
                </Button>
              );
            }
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No purchase orders found"
            description="Create a purchase order from approved requisitions or direct supplier demand."
          />
        }
      />

      {pagination ? (
        <PaginationControls
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={(page) =>
            setFilters((current) => ({
              ...current,
              page
            }))
          }
        />
      ) : null}

      <FormDrawer title="New Purchase Order" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleCreate}>
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
              <span>Requisition ID (optional)</span>
              <input
                value={formState.requisitionId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, requisitionId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Order Date</span>
              <input
                type="date"
                value={formState.orderDate}
                onChange={(event) => setFormState((current) => ({ ...current, orderDate: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Expected Delivery</span>
              <input
                type="date"
                value={formState.expectedDeliveryDate}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, expectedDeliveryDate: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Tax Amount</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={formState.taxAmount}
                onChange={(event) => setFormState((current) => ({ ...current, taxAmount: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Discount Amount</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={formState.discountAmount}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, discountAmount: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              rows={3}
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Line Items</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      { itemId: '', quantityOrdered: '1', unitCost: '0', unitOfMeasureId: '' }
                    ]
                  }))
                }
              >
                Add Item
              </Button>
            </div>
            {formState.items.map((item, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1fr_130px_140px_130px_auto]">
                <select
                  value={item.itemId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, itemId: event.target.value } : row,
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
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
                  value={item.quantityOrdered}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, quantityOrdered: event.target.value } : row,
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.unitCost}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unitCost: event.target.value } : row,
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <select
                  value={item.unitOfMeasureId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unitOfMeasureId: event.target.value } : row,
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                >
                  <option value="">UOM</option>
                  {(metaQuery.data?.units ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.abbreviation}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      items:
                        current.items.length === 1
                          ? current.items
                          : current.items.filter((_, rowIndex) => rowIndex !== index)
                    }))
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
            <Button type="submit">Create PO</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
