'use client';

import { Plus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { buildGoodsReceivedDraftPayload } from '@/lib/procurement-goods-received';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { WarehouseSelect } from '@/components/inventory/warehouse-select';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { SupplierSelect } from '@/components/procurement/supplier-select';
import { TransactionShortcuts } from '@/components/procurement/transaction-shortcuts';
import { Button } from '@/components/ui/button';
import {
  useGRNs,
  useProcurementMeta,
  useProcurementRequest,
  usePurchaseOrder,
  type GRNRow,
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

type GrnLineItem = {
  batchNumber: string;
  expiryDate: string;
  itemId: string;
  poItemId?: string;
  qualityNotes: string;
  quantityExpected: number;
  quantityReceived: string;
  quantityRejected: string;
  reason: string;
  rowId: string;
  unitCost: string;
  unitOfMeasureId: string;
};

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

function createGrnRowId() {
  return `grn-line-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEmptyGrnLineItem(): GrnLineItem {
  return {
    batchNumber: '',
    expiryDate: '',
    itemId: '',
    qualityNotes: '',
    quantityExpected: 0,
    quantityReceived: '0',
    quantityRejected: '0',
    reason: '',
    rowId: createGrnRowId(),
    unitCost: '0',
    unitOfMeasureId: '',
  };
}

export default function GoodsReceivedPage() {
  const searchParams = useSearchParams();
  const purchaseOrderIdParam = searchParams.get('purchaseOrderId');
  const canCreate = usePermission([PERMISSIONS.goodsReceived.create, 'procurement.write']);
  const canApprove = usePermission(['stores.grn.approve', 'procurement.approve']);
  const canPost = usePermission(['stores.grn.post', 'procurement.grn.post', 'inventory.write']);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    purchaseOrderId: '',
    status: ''
  });
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [lineItems, setLineItems] = useState<GrnLineItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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
  const purchaseOrderOptions = metaQuery.data?.purchaseOrders ?? [];
  const itemOptions = metaQuery.data?.items ?? [];
  const unitOptions = metaQuery.data?.units ?? [];
  const purchaseOrderLoadFailed = metaQuery.isError && purchaseOrderOptions.length === 0;
  const itemLoadFailed = metaQuery.isError && itemOptions.length === 0;
  const unitLoadFailed = metaQuery.isError && unitOptions.length === 0;

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
            item: { id: string } | null;
            quantityOrdered: number;
            quantityReceived: number;
            unitOfMeasure?: { id: string } | null;
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
        itemId: item.item?.id ?? '',
        poItemId: item.id,
        qualityNotes: '',
        quantityExpected: Math.max(0, item.quantityOrdered - item.quantityReceived),
        quantityReceived: String(Math.max(0, item.quantityOrdered - item.quantityReceived)),
        quantityRejected: '0',
        reason: '',
        rowId: createGrnRowId(),
        unitCost: String(item.unitCost ?? 0),
        unitOfMeasureId: item.unitOfMeasure?.id ?? '',
      })),
    );
  }, [purchaseOrderQuery.data, formState.entryMode]);

  useEffect(() => {
    if (formState.entryMode === 'MANUAL' && lineItems.length === 0) {
      setLineItems([buildEmptyGrnLineItem()]);
    }
  }, [formState.entryMode, lineItems.length]);

  const grns = grnsQuery.data?.data ?? [];
  const pagination = grnsQuery.data?.pagination;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
    });
  }

  async function runRowAction(actionKey: string, successMessage: string, task: () => Promise<void>) {
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await task();
      setFeedback({ message: successMessage, tone: 'success' });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'GRN action failed.',
        tone: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  }

  function addManualLine() {
    setLineItems((current) => [...current, buildEmptyGrnLineItem()]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!formState.warehouseId) {
      setFormError('Please select a receiving warehouse.');
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

    const payload = buildGoodsReceivedDraftPayload({
      entryMode: formState.entryMode.toLowerCase(),
      items: lineItems.map((item) => ({
        batchNumber: item.batchNumber || null,
        expiryDate: item.expiryDate || null,
        itemId: item.itemId,
        poItemId: item.poItemId,
        qualityNotes: item.qualityNotes || null,
        quantityExpected: Number(item.quantityExpected || 0),
        quantityReceived: Number(item.quantityReceived),
        quantityRejected: Number(item.quantityRejected),
        reason: item.reason || null,
        unitCost: Number(item.unitCost || 0),
        unitOfMeasureId: item.unitOfMeasureId,
      })),
      notes: formState.notes || null,
      purchaseOrderId: formState.entryMode === 'PO_LINKED' ? formState.purchaseOrderId : null,
      qualityNotes: formState.qualityNotes || null,
      supplierId: formState.entryMode === 'MANUAL' ? formState.supplierId : null,
      warehouseId: formState.warehouseId,
    });
    const receiveItems = payload.items;

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

    if (
      lineItems.some(
        (item) =>
          formState.entryMode === 'PO_LINKED' &&
          Number(item.quantityExpected) > 0 &&
          Number(item.quantityReceived) > Number(item.quantityExpected) &&
          !String(item.reason ?? '').trim(),
      )
    ) {
      setFormError('Provide an over-receive reason whenever the received quantity exceeds the outstanding PO quantity.');
      return;
    }

    if (
      formState.entryMode === 'MANUAL' &&
      receiveItems.some(
        (item) =>
          !item.itemId ||
          Number.isNaN(item.quantityExpected) ||
          Number.isNaN(item.unitCost) ||
          item.quantityExpected <= 0 ||
          item.unitCost < 0,
      )
    ) {
      setFormError('Manual GRNs need an item, expected quantity, and valid unit cost on every line.');
      return;
    }

    try {
      const grn = await request<{ id: string }>('/api/procurement/grns', {
        body: JSON.stringify({
          ...payload,
          items:
            formState.entryMode === 'MANUAL'
              ? payload.items.map((item) => ({
                  batchNumber: item.batchNumber,
                  expiryDate: item.expiryDate,
                  itemId: item.itemId,
                  item_id: item.item_id,
                  qualityNotes: item.qualityNotes,
                  quantityExpected: item.quantityExpected,
                  quantityReceived: item.quantityReceived,
                  quantityRejected: item.quantityRejected,
                  unitCost: item.unitCost,
                  unitOfMeasureId: item.unitOfMeasureId,
                  unit_of_measure_id: item.unit_of_measure_id,
                  uomId: item.uomId,
                }))
              : undefined,
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
      setFeedback({ message: 'GRN submitted into the approval queue.', tone: 'success' });
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

      <FilterBar
        filters={[
          {
            key: 'purchaseOrderId',
            label: 'Purchase Order',
            options: (metaQuery.data?.purchaseOrders ?? []).map((order) => ({
              label: order.label ?? `${order.poNumber} - ${order.supplier?.name ?? 'Unknown supplier'}`,
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
              { label: 'Posted', value: 'POSTED' },
              { label: 'Rejected', value: 'REJECTED' },
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
            render: (row) => (
              <div className="space-y-1">
                <StatusBadge status={row.status} />
                <p className="text-xs text-muted">
                  {row.status === 'PENDING_APPROVAL'
                    ? 'Waiting for supervisor sign-off.'
                    : row.status === 'APPROVED'
                      ? 'Approved and ready to post into HQ inventory.'
                      : row.status === 'POSTED'
                        ? 'Inventory posted.'
                        : row.status === 'REJECTED'
                          ? 'Rejected and not posted.'
                          : 'Draft receipt.'}
                </p>
              </div>
            )
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              if (row.status === 'PENDING_APPROVAL') {
                return (
                  <div className="flex flex-wrap gap-2">
                    {canApprove ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingAction === `approve:${row.id}`}
                          onClick={() =>
                            void runRowAction(`approve:${row.id}`, 'GRN approved.', async () => {
                              await request(`/api/procurement/grns/${row.id}/approve`, { body: JSON.stringify({}), method: 'POST' });
                              await refresh();
                            })
                          }
                        >
                          {pendingAction === `approve:${row.id}` ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingAction === `reject:${row.id}`}
                          onClick={() =>
                            void runRowAction(`reject:${row.id}`, 'GRN rejected.', async () => {
                              await request(`/api/procurement/grns/${row.id}/reject`, { body: JSON.stringify({}), method: 'POST' });
                              await refresh();
                            })
                          }
                        >
                          {pendingAction === `reject:${row.id}` ? 'Rejecting...' : 'Reject'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                );
              }

              if (row.status === 'APPROVED') {
                return (
                  canPost ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingAction === `post:${row.id}`}
                      onClick={() =>
                        void runRowAction(`post:${row.id}`, 'GRN posted into HQ inventory.', async () => {
                          await request(`/api/procurement/grns/${row.id}/post`, { body: JSON.stringify({}), method: 'POST' });
                          await refresh();
                        })
                      }
                    >
                      {pendingAction === `post:${row.id}` ? 'Posting...' : 'Post to HQ Inventory'}
                    </Button>
                  ) : null
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

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            This GRN workflow posts accepted stock into an HQ warehouse only after supervisor approval and inventory posting.
          </div>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Supplier / Purchase Order Details</p>
              <p className="mt-1 text-xs text-muted">Choose whether the receipt is PO-linked or manual, then confirm the supplier and receiving warehouse before quantity capture.</p>
            </div>
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
                <option value="MANUAL">Manual Receipt Without PO</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Order</span>
              <select
                required={formState.entryMode === 'PO_LINKED'}
                disabled={formState.entryMode !== 'PO_LINKED' || metaQuery.isLoading || purchaseOrderLoadFailed || purchaseOrderOptions.length === 0}
                value={formState.purchaseOrderId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, purchaseOrderId: event.target.value }))
                }
                className="surface-input-soft"
              >
                <option value="">
                  {metaQuery.isLoading
                    ? 'Loading purchase orders...'
                    : purchaseOrderLoadFailed
                      ? 'Purchase orders unavailable'
                      : purchaseOrderOptions.length === 0
                        ? 'No purchase orders available'
                        : 'Select PO'}
                </option>
                {formState.purchaseOrderId &&
                !purchaseOrderOptions.some((order) => order.id === formState.purchaseOrderId) ? (
                  <option value={formState.purchaseOrderId}>Saved purchase order selection</option>
                ) : null}
                {purchaseOrderOptions.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.poNumber} - {order.supplier?.name ?? 'Unknown supplier'}
                  </option>
                ))}
              </select>
              {purchaseOrderLoadFailed ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                  <span>Unable to load purchase orders right now. Please refresh and try again.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => void metaQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : !metaQuery.isLoading && purchaseOrderOptions.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                  No purchase orders available for receiving.
                </div>
              ) : null}
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Supplier</span>
              <SupplierSelect
                required={formState.entryMode === 'MANUAL'}
                disabled={formState.entryMode !== 'MANUAL'}
                value={formState.supplierId}
                onChange={(supplierId) => setFormState((current) => ({ ...current, supplierId }))}
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
                            unitCost: String(createdItem.unitCost ?? 0),
                            unitOfMeasureId: createdItem.unitOfMeasureId,
                          }
                        : row,
                    ),
                  )
                }
                onUomCreated={(unit) =>
                  setLineItems((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === current.length - 1 && !row.unitOfMeasureId
                        ? { ...row, unitOfMeasureId: unit.id }
                        : row,
                    ),
                  )
                }
              />
            </div>
            <label className="space-y-2 text-sm text-muted">
              <span>Receiving Warehouse</span>
              <WarehouseSelect
                required
                value={formState.warehouseId}
                onChange={(warehouseId) => setFormState((current) => ({ ...current, warehouseId }))}
                placeholder="Select receiving warehouse"
              />
            </label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Approval / Posting</p>
              <p className="mt-1 text-xs text-muted">Quality notes and posting safeguards stay with the GRN until approval and warehouse posting are completed.</p>
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
          </section>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Received Items</p>
              <p className="mt-1 text-xs text-muted">
                PO-linked receipts inherit the selected PO lines. Manual receipts let you capture stock even when no PO was used.
              </p>
            </div>
            {lineItems.map((item, index) => (
              <div key={item.rowId} className="grid gap-3 md:grid-cols-[1fr_120px_140px_120px_120px_120px_1fr_1fr]">
                <select
                  value={item.itemId}
                  disabled={formState.entryMode === 'PO_LINKED' || metaQuery.isLoading || itemLoadFailed || itemOptions.length === 0}
                  onChange={(event) =>
                    setLineItems((current) => {
                      const selectedItem = itemOptions.find((row) => row.id === event.target.value) ?? null;

                      return current.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              itemId: event.target.value,
                              unitCost: String(
                                selectedItem?.purchase_price ??
                                  selectedItem?.cost_price ??
                                  selectedItem?.unit_cost ??
                                  selectedItem?.default_purchase_price ??
                                  0,
                              ),
                              unitOfMeasureId: selectedItem?.unitOfMeasureId ?? row.unitOfMeasureId,
                            }
                          : row,
                      );
                    })
                  }
                  className="surface-input-soft"
                >
                  <option value="">
                    {metaQuery.isLoading
                      ? 'Loading items...'
                      : itemLoadFailed
                        ? 'Items unavailable'
                        : itemOptions.length === 0
                          ? 'No items found'
                          : 'Select item'}
                  </option>
                  {item.itemId &&
                  !itemOptions.some((candidate) => candidate.id === item.itemId) ? (
                    <option value={item.itemId}>Saved item selection</option>
                  ) : null}
                  {itemOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label ?? (row.code ? `${row.code} - ${row.name}` : row.name)}
                    </option>
                  ))}
                </select>
                <select
                  value={item.unitOfMeasureId}
                  disabled={metaQuery.isLoading || unitLoadFailed || unitOptions.length === 0}
                  className="surface-input-soft"
                  onChange={(event) =>
                    setLineItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unitOfMeasureId: event.target.value } : row,
                      ),
                    )
                  }
                >
                  <option value="">
                    {metaQuery.isLoading
                      ? 'Loading units...'
                      : unitLoadFailed
                        ? 'Units unavailable'
                        : unitOptions.length === 0
                          ? 'No units found'
                          : 'UOM'}
                  </option>
                  {item.unitOfMeasureId &&
                  !unitOptions.some((candidate) => candidate.id === item.unitOfMeasureId) ? (
                    <option value={item.unitOfMeasureId}>Saved unit selection</option>
                  ) : null}
                  {unitOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label ?? row.symbol ?? row.code ?? row.name}
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
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="Unit cost"
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
            {itemLoadFailed ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                <span>Unable to load items right now. Please refresh and try again.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => void metaQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : !metaQuery.isLoading && itemOptions.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                No items found. Create an item first.
              </div>
            ) : null}
            {unitLoadFailed ? (
              <div className="rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                Unable to load units of measurement right now. Please refresh and try again.
              </div>
            ) : !metaQuery.isLoading && unitOptions.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                No units of measurement found. Create units first.
              </div>
            ) : null}
            {formState.entryMode === 'MANUAL' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addManualLine}
              >
                Add Manual Item
              </Button>
            ) : null}
          </div>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Audit Trail</p>
              <p className="mt-1 text-xs text-muted">Approval, rejection, and posting events are logged on the server and remain linked to the GRN and resulting stock movement.</p>
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
          </section>

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
