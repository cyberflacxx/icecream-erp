'use client';

import { Plus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
import {
  useGRNs,
  useProcurementMeta,
  useProcurementRequest,
  usePurchaseOrder,
  type GRNRow
} from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

const initialFormState = {
  notes: '',
  purchaseOrderId: '',
  qualityNotes: '',
  warehouseId: ''
};

export default function GoodsReceivedPage() {
  const canCreate = usePermission(PERMISSIONS.goodsReceived.create);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    purchaseOrderId: '',
    status: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [lineItems, setLineItems] = useState<
    Array<{
      batchNumber: string;
      expiryDate: string;
      itemId: string;
      poItemId: string;
      qualityNotes: string;
      quantityExpected: number;
      quantityReceived: string;
      quantityRejected: string;
      reason: string;
    }>
  >([]);
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const metaQuery = useProcurementMeta();
  const grnsQuery = useGRNs({
    page: filters.page,
    pageSize: filters.pageSize,
    purchaseOrderId: filters.purchaseOrderId || undefined,
    status: filters.status || undefined
  });
  const purchaseOrderQuery = usePurchaseOrder(formState.purchaseOrderId || undefined);

  useEffect(() => {
    const order = purchaseOrderQuery.data as
      | {
          items: Array<{
            id: string;
            item: { id: string };
            quantityOrdered: number;
            quantityReceived: number;
          }>;
        }
      | undefined;

    if (!order) {
      setLineItems([]);
      return;
    }

    setLineItems(
      order.items.map((item) => ({
        batchNumber: '',
        expiryDate: '',
        itemId: item.item.id,
        poItemId: item.id,
        qualityNotes: '',
        quantityExpected: Math.max(0, item.quantityOrdered - item.quantityReceived),
        quantityReceived: String(Math.max(0, item.quantityOrdered - item.quantityReceived)),
        quantityRejected: '0',
        reason: ''
      })),
    );
  }, [purchaseOrderQuery.data]);

  const grns = grnsQuery.data?.data ?? [];
  const pagination = grnsQuery.data?.pagination;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.purchaseOrderId || !formState.warehouseId) {
      setFormError('Purchase order and warehouse are required.');
      return;
    }

    if (!lineItems.length) {
      setFormError('No line items available for this purchase order.');
      return;
    }

    const receiveItems = lineItems.map((item) => ({
      batchNumber: item.batchNumber || null,
      expiryDate: item.expiryDate || null,
      itemId: item.itemId,
      overReceiveReason: item.reason || null,
      poItemId: item.poItemId,
      qualityNotes: item.qualityNotes || null,
      quantityReceived: Number(item.quantityReceived),
      quantityRejected: Number(item.quantityRejected)
    }));

    if (
      receiveItems.some(
        (item) =>
          Number.isNaN(item.quantityReceived) ||
          Number.isNaN(item.quantityRejected) ||
          item.quantityReceived < 0 ||
          item.quantityRejected < 0,
      )
    ) {
      setFormError('Invalid quantities detected in one or more line items.');
      return;
    }

    try {
      const grn = await request<{ id: string }>('/api/procurement/grns', {
        body: JSON.stringify({
          notes: formState.notes || null,
          purchaseOrderId: formState.purchaseOrderId,
          qualityNotes: formState.qualityNotes || null,
          warehouseId: formState.warehouseId
        }),
        method: 'POST'
      });

      await request(`/api/procurement/grns/${grn.id}/receive`, {
        body: JSON.stringify({
          items: receiveItems,
          notes: formState.notes || null
        }),
        method: 'POST'
      });

      setIsDrawerOpen(false);
      setFormError(null);
      setFormState(initialFormState);
      setLineItems([]);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to receive GRN.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Received Notes"
        description="Record receipt quantities against supplier purchase orders and post accepted stock into inventory batches."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New GRN
            </Button>
          ) : null
        }
      />

      <ProcurementNav />

      <FilterBar
        filters={[
          {
            key: 'purchaseOrderId',
            label: 'Purchase Order',
            options: (metaQuery.data?.purchaseOrders ?? []).map((order) => ({
              label: `${order.poNumber} - ${order.supplier.name}`,
              value: order.id
            })),
            type: 'select',
            value: filters.purchaseOrderId
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'DRAFT', value: 'DRAFT' },
              { label: 'RECEIVED', value: 'RECEIVED' },
              { label: 'QUALITY_PASSED', value: 'QUALITY_PASSED' },
              { label: 'QUALITY_FAILED', value: 'QUALITY_FAILED' }
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

      <DataTable<GRNRow>
        data={grns}
        loading={grnsQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'grnNumber', header: 'GRN #' },
          {
            key: 'poNumber',
            header: 'PO #',
            render: (row) => row.purchaseOrder.poNumber
          },
          {
            key: 'supplier',
            header: 'Supplier',
            render: (row) => row.supplier.name
          },
          {
            key: 'receivedDate',
            header: 'Received Date',
            render: (row) => new Date(row.receivedDate).toLocaleDateString()
          },
          {
            key: 'itemsCount',
            header: 'Items',
            render: (row) => String(row.itemsCount)
          },
          {
            key: 'qualityStatus',
            header: 'Quality Status',
            render: (row) => <StatusBadge status={row.qualityStatus} />
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />
          },
          {
            key: 'actions',
            header: 'Actions',
            render: () => <Button size="sm" variant="outline">View</Button>
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No GRNs found"
            description="Create and receive a GRN from a sent purchase order."
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

      <FormDrawer title="New Goods Received Note" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Order</span>
              <select
                required
                value={formState.purchaseOrderId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, purchaseOrderId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              >
                <option value="">Select PO</option>
                {(metaQuery.data?.purchaseOrders ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.poNumber} - {order.supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Warehouse</span>
              <select
                required
                value={formState.warehouseId}
                onChange={(event) => setFormState((current) => ({ ...current, warehouseId: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              >
                <option value="">Select warehouse</option>
                {(metaQuery.data?.warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Quality Notes</span>
            <textarea
              rows={2}
              value={formState.qualityNotes}
              onChange={(event) =>
                setFormState((current) => ({ ...current, qualityNotes: event.target.value }))
              }
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Expected and Received</p>
            {lineItems.map((item, index) => (
              <div key={item.poItemId} className="grid gap-3 md:grid-cols-[120px_120px_120px_1fr_1fr]">
                <input
                  readOnly
                  value={item.quantityExpected}
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={item.quantityReceived}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, quantityReceived: event.target.value } : row,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={item.quantityRejected}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, quantityRejected: event.target.value } : row,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <input
                  placeholder="Batch #"
                  value={item.batchNumber}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, batchNumber: event.target.value } : row,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <input
                  type="date"
                  value={item.expiryDate}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, expiryDate: event.target.value } : row,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <input
                  placeholder="Over-receive reason (required if over ordered)"
                  value={item.reason}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, reason: event.target.value } : row,
                      ),
                    )
                  }
                  className="md:col-span-5 h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
              </div>
            ))}
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit & Receive</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
