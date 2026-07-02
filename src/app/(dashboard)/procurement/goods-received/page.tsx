'use client';

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
  useGRNs,
  useProcurementMeta,
  useProcurementRequest,
  usePurchaseOrder,
  type GRNRow
} from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

const initialFormState = {
  entryMode: 'PO_LINKED',
  notes: '',
  purchaseOrderId: '',
  qualityNotes: '',
  supplierId: '',
  warehouseId: ''
};

export default function GoodsReceivedPage() {
  const searchParams = useSearchParams();
  const purchaseOrderIdParam = searchParams.get('purchaseOrderId');
  const canCreate = usePermission([PERMISSIONS.goodsReceived.create, 'procurement.write']);
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
      poItemId?: string;
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
    if (!purchaseOrderIdParam) {
      return;
    }

    setFormState((current) => ({ ...current, entryMode: 'PO_LINKED', purchaseOrderId: purchaseOrderIdParam }));
    setIsDrawerOpen(true);
  }, [purchaseOrderIdParam]);

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

    if (!order || formState.entryMode !== 'PO_LINKED') {
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

  useEffect(() => {
    if (formState.entryMode === 'MANUAL' && lineItems.length === 0) {
      setLineItems([
        {
          batchNumber: '',
          expiryDate: '',
          itemId: '',
          qualityNotes: '',
          quantityExpected: 0,
          quantityReceived: '0',
          quantityRejected: '0',
          reason: ''
        }
      ]);
    }
  }, [formState.entryMode, lineItems.length]);

  const grns = grnsQuery.data?.data ?? [];
  const pagination = grnsQuery.data?.pagination;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.warehouseId) {
      setFormError('HQ warehouse is required.');
      return;
    }

    if (formState.entryMode === 'PO_LINKED' && !formState.purchaseOrderId) {
      setFormError('Purchase order is required for PO-linked GRNs.');
      return;
    }

    if (formState.entryMode === 'MANUAL' && !formState.supplierId) {
      setFormError('Supplier is required for manual GRNs.');
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
          entryMode: formState.entryMode.toLowerCase(),
          purchaseOrderId: formState.entryMode === 'PO_LINKED' ? formState.purchaseOrderId : null,
          qualityNotes: formState.qualityNotes || null,
          supplierId: formState.entryMode === 'MANUAL' ? formState.supplierId : null,
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
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Posted', value: 'POSTED' }
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
          { key: 'entryMode', header: 'Mode' },
          {
            key: 'poNumber',
            header: 'PO #',
            render: (row) => row.purchaseOrder?.poNumber ?? 'Manual'
          },
          {
            key: 'supplier',
            header: 'Supplier',
            render: (row) => row.supplier?.name ?? 'Unknown supplier'
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
            render: (row) => {
              if (row.status === 'PENDING_APPROVAL') {
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        request(`/api/procurement/grns/${row.id}/approve`, { body: JSON.stringify({}), method: 'POST' }).then(refresh)
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        request(`/api/procurement/grns/${row.id}/reject`, { body: JSON.stringify({}), method: 'POST' }).then(refresh)
                      }
                    >
                      Reject
                    </Button>
                  </div>
                );
              }

              if (row.status === 'APPROVED') {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      request(`/api/procurement/grns/${row.id}/post`, { body: JSON.stringify({}), method: 'POST' }).then(refresh)
                    }
                  >
                    Post to Inventory
                  </Button>
                );
              }

              return <span className="text-sm text-muted">No actions</span>;
            }
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No GRNs found"
            description="Create and submit a GRN from a sent purchase order."
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
              <span>Entry Mode</span>
              <select
                value={formState.entryMode}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    entryMode: event.target.value,
                    purchaseOrderId: event.target.value === 'PO_LINKED' ? current.purchaseOrderId : '',
                    supplierId: event.target.value === 'MANUAL' ? current.supplierId : ''
                  }))
                }
                className="surface-input-soft"
              >
                <option value="PO_LINKED">Linked to Purchase Order</option>
                <option value="MANUAL">Manual Receipt</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Order</span>
              <select
                required={formState.entryMode === 'PO_LINKED'}
                disabled={formState.entryMode !== 'PO_LINKED'}
                value={formState.purchaseOrderId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, purchaseOrderId: event.target.value }))
                }
                className="surface-input-soft"
              >
                <option value="">Select PO</option>
                {(metaQuery.data?.purchaseOrders ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.poNumber} - {order.supplier?.name ?? 'Unknown supplier'}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Supplier</span>
              <select
                required={formState.entryMode === 'MANUAL'}
                disabled={formState.entryMode !== 'MANUAL'}
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
              <span>HQ Warehouse</span>
              <select
                required
                value={formState.warehouseId}
                onChange={(event) => setFormState((current) => ({ ...current, warehouseId: event.target.value }))}
                className="surface-input-soft"
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
              className="surface-textarea-soft"
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Expected and Received</p>
            {lineItems.map((item, index) => (
              <div key={item.poItemId ?? `${item.itemId}-${index}`} className="grid gap-3 md:grid-cols-[1fr_120px_120px_120px_1fr_1fr]">
                <select
                  value={item.itemId}
                  disabled={formState.entryMode === 'PO_LINKED'}
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
                  value={item.quantityExpected}
                  readOnly={formState.entryMode === 'PO_LINKED'}
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, quantityExpected: Number(event.target.value) || 0 }
                          : row,
                      ),
                    )
                  }
                  className="surface-input-soft"
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
                  className="surface-input-soft"
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
                  className="surface-input-soft"
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
                  className="surface-input-soft"
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
                  className="surface-input-soft"
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
                  className="surface-input-soft md:col-span-5"
                />
              </div>
            ))}
            {formState.entryMode === 'MANUAL' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLineItems((current) => [
                    ...current,
                    {
                      batchNumber: '',
                      expiryDate: '',
                      itemId: '',
                      qualityNotes: '',
                      quantityExpected: 0,
                      quantityReceived: '0',
                      quantityRejected: '0',
                      reason: ''
                    }
                  ])
                }
              >
                Add Manual Item
              </Button>
            ) : null}
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit GRN</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
