'use client';

import Link from 'next/link';
import { ArrowRightLeft, MoveRight, Package2, Plus, Truck } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ItemSelectorField } from '@/components/shared/item-selector-field';
import { DataTable, EmptyState, FilterBar, FormDrawer, PermissionGate, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import {
  useCreateTransfer,
  useInventoryMeta,
  useTransfers,
  type StockTransferRow,
} from '@/hooks/inventory';
import { useInventoryRequest } from '@/hooks/inventory/useInventoryRequest';
import { usePermission } from '@/hooks/usePermission';

const transferStatusOptions = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Partially Received', value: 'PARTIALLY_RECEIVED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
] as const;

const initialTransferForm = {
  fromWarehouseId: '',
  items: [
    {
      batchNumber: '',
      itemId: '',
      quantity: '0',
      unitCost: '0',
    },
  ],
  referenceNumber: '',
  remarks: '',
  status: 'DRAFT',
  transferDate: new Date().toISOString().slice(0, 10),
  toWarehouseId: '',
};

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

interface TransferReceiptLineState {
  itemCode: string;
  itemId: string;
  itemName: string;
  quantityReceived: number;
  quantityRequested: number;
  quantitySent: number;
  receiptQuantity: string;
  remainingQuantity: number;
  transferItemId: string;
  unitCost: number;
}

interface TransferReceiptState {
  lines: TransferReceiptLineState[];
  status: string;
  transferId: string;
  transferNumber: string;
}

function formatTransferStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function TransfersPage() {
  const canCreateTransfer = usePermission(PERMISSIONS.stockTransfer.create);
  const canApproveTransfer = usePermission(['inventory.transfer.approve', 'inventory.write', 'stock_transfer.approve']);
  const canCompleteTransfer = usePermission(['inventory.transfer.complete', 'inventory.write', 'stock_transfer.approve']);
  const canCancelTransfer = usePermission(['inventory.transfer.cancel', 'inventory.write', 'stock_transfer.approve']);
  const canReverseDispatch = usePermission(['inventory.transfer.reverse_dispatch', 'inventory.write']);
  const canReverseReceipt = usePermission(['inventory.transfer.reverse_receipt', 'inventory.write']);
  const request = useInventoryRequest();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    fromWarehouseId: '',
    page: 1,
    pageSize: 10,
    status: '',
    toWarehouseId: '',
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialTransferForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isReceiptDrawerOpen, setIsReceiptDrawerOpen] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptState, setReceiptState] = useState<TransferReceiptState | null>(null);

  const metaQuery = useInventoryMeta();
  const transfersQuery = useTransfers({
    fromWarehouseId: filters.fromWarehouseId || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
    toWarehouseId: filters.toWarehouseId || undefined,
  });
  const createTransferMutation = useCreateTransfer();
  const itemOptionsQuery = useItemSelectorOptions({
    includeCost: true,
    includeStock: true,
    warehouseId: formState.fromWarehouseId || undefined,
  });

  const transfers = transfersQuery.data?.data ?? [];
  const pagination = transfersQuery.data?.pagination;
  const selectedSource = metaQuery.data?.warehouses.find((warehouse) => warehouse.id === formState.fromWarehouseId) ?? null;
  const selectedDestination = metaQuery.data?.warehouses.find((warehouse) => warehouse.id === formState.toWarehouseId) ?? null;
  const activeStatusLabel = useMemo(
    () => transferStatusOptions.find((option) => option.value === formState.status)?.label ?? formState.status,
    [formState.status],
  );

  async function refreshTransfers() {
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }

  async function runTransferAction(actionKey: string, successMessage: string, task: () => Promise<void>) {
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await task();
      await refreshTransfers();
      setFeedback({ message: successMessage, tone: 'success' });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Transfer action failed.',
        tone: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function openReceiptDrawer(transferId: string) {
    setPendingAction(`load-receipt:${transferId}`);
    setReceiptError(null);

    try {
      const transfer = await request<{
        id: string;
        status: string;
        stock_transfer_items?: Array<{
          id: string;
          item_id: string;
          items?: { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }>;
          quantity_received?: number | null;
          quantity_requested?: number | null;
          quantity_sent?: number | null;
          unit_cost?: number | null;
        }>;
        transfer_number?: string | null;
      }>(`/api/inventory/transfers/${transferId}`);

      const lines = (transfer.stock_transfer_items ?? [])
        .map((line) => {
          const item = Array.isArray(line.items) ? line.items[0] : line.items;
          const quantityRequested = Number(line.quantity_requested ?? 0);
          const rawQuantitySent = Number(line.quantity_sent ?? 0);
          const quantitySent = rawQuantitySent > 0 ? rawQuantitySent : quantityRequested;
          const quantityReceived = Number(line.quantity_received ?? 0);
          const remainingQuantity = Math.max(0, quantitySent - quantityReceived);

          return {
            itemCode: String(item?.code ?? ''),
            itemId: String(line.item_id ?? ''),
            itemName: String(item?.name ?? 'Unknown item'),
            quantityReceived,
            quantityRequested,
            quantitySent,
            receiptQuantity: remainingQuantity > 0 ? String(remainingQuantity) : '0',
            remainingQuantity,
            transferItemId: String(line.id ?? ''),
            unitCost: Number(line.unit_cost ?? 0),
          };
        })
        .filter((line) => line.remainingQuantity > 0 || transfer.status === 'APPROVED');

      if (!lines.length) {
        throw new Error('No remaining transfer quantity is available for receipt.');
      }

      setReceiptState({
        lines,
        status: String(transfer.status ?? ''),
        transferId,
        transferNumber: String(transfer.transfer_number ?? transferId),
      });
      setIsReceiptDrawerOpen(true);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Unable to load transfer receipt lines.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReceiptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!receiptState) {
      return;
    }

    const receiptLines = receiptState.lines
      .map((line) => ({
        quantityReceived: Number(line.receiptQuantity),
        transferItemId: line.transferItemId,
      }))
      .filter((line) => Number.isFinite(line.quantityReceived) && line.quantityReceived > 0);

    if (!receiptLines.length) {
      setReceiptError('Enter at least one receipt quantity above zero.');
      return;
    }

    const invalidLine = receiptState.lines.find((line) => {
      const quantityReceived = Number(line.receiptQuantity);
      return quantityReceived < 0 || quantityReceived > line.remainingQuantity;
    });

    if (invalidLine) {
      setReceiptError(`Receipt quantity for ${invalidLine.itemName} exceeds the remaining in-transit quantity.`);
      return;
    }

    await runTransferAction(
      `complete:${receiptState.transferId}`,
      receiptState.status === 'APPROVED'
        ? 'Transfer dispatched and receipt posted.'
        : 'Transfer receipt posted.',
      async () => {
        await request(`/api/inventory/transfers/${receiptState.transferId}/complete`, {
          body: JSON.stringify({ receiptLines }),
          method: 'POST',
        });
        setIsReceiptDrawerOpen(false);
        setReceiptState(null);
        setReceiptError(null);
      },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validItems = formState.items
      .filter((item) => item.itemId)
      .map((item) => ({
        batchNumber: item.batchNumber || null,
        itemId: item.itemId,
        quantity: Number(item.quantity),
        unitCost: item.unitCost ? Number(item.unitCost) : undefined,
      }));

    if (!formState.fromWarehouseId || !formState.toWarehouseId) {
      setFormError('Both source and destination warehouses are required.');
      return;
    }

    if (formState.fromWarehouseId === formState.toWarehouseId) {
      setFormError('Source and destination warehouses must be different.');
      return;
    }

    if (
      !validItems.length ||
      validItems.some(
        (item) =>
          Number.isNaN(item.quantity) ||
          item.quantity <= 0 ||
          (item.unitCost !== undefined && (Number.isNaN(item.unitCost) || item.unitCost < 0)),
      )
    ) {
      setFormError('Every transfer line must have an item, a quantity above zero, and a non-negative price.');
      return;
    }

    setFormError(null);
    setFeedback(null);

    try {
      await createTransferMutation.mutateAsync({
        fromWarehouseId: formState.fromWarehouseId,
        items: validItems,
        referenceNumber: formState.referenceNumber || undefined,
        remarks: formState.remarks || null,
        status: formState.status,
        transferDate: formState.transferDate,
        toWarehouseId: formState.toWarehouseId,
      });
      setFormState(initialTransferForm);
      setIsDrawerOpen(false);
      setFilters((current) => ({
        ...current,
        page: 1,
      }));
      setFeedback({ message: `Transfer saved with ${activeStatusLabel.toLowerCase()} status.`, tone: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create stock transfer.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description="Run disciplined warehouse-to-warehouse transfers with the right status trail, reference details, and item-level movement control."
        actions={
          <PermissionGate permission={PERMISSIONS.stockTransfer.create}>
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
              New Transfer
            </Button>
          </PermissionGate>
        }
      />

      <InventoryNav />

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
            key: 'fromWarehouseId',
            label: 'Source warehouse',
            type: 'select',
            value: filters.fromWarehouseId,
            options:
              metaQuery.data?.warehouses.map((warehouse) => ({
                label: warehouse.name,
                value: warehouse.id,
              })) ?? [],
          },
          {
            key: 'toWarehouseId',
            label: 'Destination warehouse',
            type: 'select',
            value: filters.toWarehouseId,
            options:
              metaQuery.data?.warehouses.map((warehouse) => ({
                label: warehouse.name,
                value: warehouse.id,
              })) ?? [],
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: filters.status,
            options: [...transferStatusOptions],
          },
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
            page: 1,
          }))
        }
      />

      <DataTable<StockTransferRow>
        data={transfers}
        loading={transfersQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'transferNumber', header: 'Transfer #' },
          {
            key: 'route',
            header: 'Route',
            render: (row) => (
              <div className="space-y-1 text-sm">
                <p>{row.fromWarehouse?.name ?? 'Unknown source'}</p>
                <p className="text-xs text-muted">{row.toWarehouse?.name ?? 'Unknown destination'}</p>
              </div>
            ),
          },
          {
            key: 'transferDate',
            header: 'Date',
            render: (row) => new Date(row.transferDate).toLocaleDateString(),
          },
          {
            key: 'itemsCount',
            header: 'Items',
            render: (row) => String(row.itemsCount),
          },
          {
            key: 'notes',
            header: 'Reference / Remarks',
            render: (row) => row.notes || '-',
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <div className="space-y-1">
                <StatusBadge status={formatTransferStatus(row.status)} />
                {row.reversal ? (
                  <p className="text-xs text-muted">
                    {row.reversal.operationType.replaceAll('_', ' ').toLowerCase()} · {row.reversal.reversalJournalNumber ?? row.reversal.reversalJournalId ?? row.reversal.id}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {row.status === 'DRAFT' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `submit:${row.id}`}
                    onClick={() =>
                      void runTransferAction(`submit:${row.id}`, 'Transfer submitted for approval.', async () => {
                        await request(`/api/inventory/transfers/${row.id}/submit`, { method: 'POST' });
                      })
                    }
                  >
                    {pendingAction === `submit:${row.id}` ? 'Submitting...' : 'Submit'}
                  </Button>
                ) : null}
                {canApproveTransfer && row.status === 'PENDING_APPROVAL' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `approve:${row.id}`}
                    onClick={() =>
                      void runTransferAction(`approve:${row.id}`, 'Transfer approved.', async () => {
                        await request(`/api/inventory/transfers/${row.id}/approve`, { method: 'POST' });
                      })
                    }
                  >
                    {pendingAction === `approve:${row.id}` ? 'Approving...' : 'Approve'}
                  </Button>
                ) : null}
                {canCompleteTransfer && ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(row.status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `load-receipt:${row.id}` || pendingAction === `complete:${row.id}`}
                    onClick={() => void openReceiptDrawer(row.id)}
                  >
                    {pendingAction === `load-receipt:${row.id}` || pendingAction === `complete:${row.id}`
                      ? 'Preparing...'
                      : row.status === 'APPROVED'
                        ? 'Dispatch & Receive'
                        : 'Receive Remaining'}
                  </Button>
                ) : null}
                {canReverseDispatch && row.status === 'IN_TRANSIT' && !row.dispatchReversal ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `reverse-dispatch:${row.id}`}
                    onClick={() => {
                      const reason = window.prompt('Enter the transfer dispatch reversal reason.');
                      if (!reason || !reason.trim()) return;
                      void runTransferAction(`reverse-dispatch:${row.id}`, 'Transfer dispatch reversed.', async () => {
                        await request(`/api/inventory/transfers/${row.id}/reverse-dispatch`, {
                          body: JSON.stringify({ reason: reason.trim() }),
                          method: 'POST',
                        });
                      });
                    }}
                  >
                    {pendingAction === `reverse-dispatch:${row.id}` ? 'Reversing...' : 'Reverse Dispatch'}
                  </Button>
                ) : null}
                {canReverseReceipt && ['COMPLETED', 'PARTIALLY_RECEIVED'].includes(row.status) && !row.receiptReversal ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `reverse-receipt:${row.id}`}
                    onClick={() => {
                      const reason = window.prompt('Enter the transfer receipt reversal reason.');
                      if (!reason || !reason.trim()) return;
                      void runTransferAction(`reverse-receipt:${row.id}`, 'Transfer receipt reversed.', async () => {
                        await request(`/api/inventory/transfers/${row.id}/reverse-receipt`, {
                          body: JSON.stringify({ reason: reason.trim() }),
                          method: 'POST',
                        });
                      });
                    }}
                  >
                    {pendingAction === `reverse-receipt:${row.id}` ? 'Reversing...' : 'Reverse Receipt'}
                  </Button>
                ) : null}
                {canCancelTransfer && row.status !== 'COMPLETED' && row.status !== 'CANCELLED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `cancel:${row.id}`}
                    onClick={() =>
                      void runTransferAction(`cancel:${row.id}`, 'Transfer cancelled.', async () => {
                        await request(`/api/inventory/transfers/${row.id}/cancel`, { method: 'POST' });
                      })
                    }
                  >
                    {pendingAction === `cancel:${row.id}` ? 'Cancelling...' : 'Cancel'}
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href="/inventory/stock-movements">View Trail</Link>
                </Button>
                {row.reversal ? (
                  <div className="w-full text-xs text-muted">
                    <p>{row.reversal.reason}</p>
                    <p>
                      Original journal: {row.reversal.originalJournalId ?? '-'} · Reversal journal: {row.reversal.reversalJournalNumber ?? row.reversal.reversalJournalId ?? '-'}
                    </p>
                    <p>
                      Movements: {row.reversal.originalMovementIds.length} original / {row.reversal.reversalMovementIds.length} reversal
                    </p>
                  </div>
                ) : null}
              </div>
            ),
          },
        ]}
        emptyState={
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="No transfers found"
            description="Create the first warehouse-to-warehouse transfer when stock needs to move between raw materials, production, finished goods, dispatch, or returns."
            action={
              canCreateTransfer ? (
                <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
                  New Transfer
                </Button>
              ) : null
            }
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
              page,
            }))
          }
        />
      ) : null}

      <FormDrawer title="Warehouse Transfer" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Save transfers as drafts while users prepare them, submit for approval, then post dispatch and receipt through the completion workflow.
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-muted">
              <span>Reference number</span>
              <input
                value={formState.referenceNumber}
                onChange={(event) => setFormState((current) => ({ ...current, referenceNumber: event.target.value }))}
                className="surface-input-soft"
                placeholder="Auto-generate if blank"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Transfer date</span>
              <input
                required
                type="date"
                value={formState.transferDate}
                onChange={(event) => setFormState((current) => ({ ...current, transferDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Status</span>
              <select
                value={formState.status}
                onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
                className="surface-input-soft"
              >
                {transferStatusOptions.filter((option) => ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(option.value)).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Source warehouse</span>
              <select
                required
                value={formState.fromWarehouseId}
                onChange={(event) => setFormState((current) => ({ ...current, fromWarehouseId: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">Select source</option>
                {metaQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Destination warehouse</span>
              <select
                required
                value={formState.toWarehouseId}
                onChange={(event) => setFormState((current) => ({ ...current, toWarehouseId: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">Select destination</option>
                {metaQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(selectedSource || selectedDestination) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedSource ? (
                <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Source</p>
                  <p className="mt-2 text-brown">{selectedSource.name}</p>
                  <p className="mt-1">{selectedSource.type.replaceAll('_', ' ')}</p>
                </div>
              ) : null}
              {selectedDestination ? (
                <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Destination</p>
                  <p className="mt-2 text-brown">{selectedDestination.name}</p>
                  <p className="mt-1">{selectedDestination.type.replaceAll('_', ' ')}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Transfer lines</p>
                <p className="mt-1 text-sm text-muted">
                  Capture item, quantity, price, and batch or lot details where applicable.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    items: [...current.items, { batchNumber: '', itemId: '', quantity: '0', unitCost: '0' }],
                  }))
                }
              >
                Add Row
              </Button>
            </div>

            {formState.items.map((itemRow, index) => (
              <div key={`${index}-${itemRow.itemId}`} className="grid gap-3 xl:grid-cols-[1.2fr_120px_140px_1fr_auto]">
                <ItemSelectorField
                  value={itemRow.itemId}
                  options={itemOptionsQuery.data ?? []}
                  loading={itemOptionsQuery.isLoading}
                  errorMessage={itemOptionsQuery.error?.message ?? null}
                  emptyMessage="No transfer items are available for the selected source warehouse."
                  onChange={(nextItemId) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) => {
                        if (rowIndex !== index) return row;
                        const selectedItem = itemOptionsQuery.data?.find((item) => item.id === nextItemId) ?? null;
                        return {
                          ...row,
                          itemId: nextItemId,
                          unitCost:
                            selectedItem?.currentInventoryCost !== null && selectedItem?.currentInventoryCost !== undefined
                              ? String(selectedItem.currentInventoryCost)
                              : row.unitCost,
                        };
                      }),
                    }))
                  }
                />
                <input
                  min="0.001"
                  step="0.001"
                  type="number"
                  value={itemRow.quantity}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, quantity: event.target.value } : row,
                      ),
                    }))
                  }
                  className="surface-input-soft"
                  placeholder="Qty"
                />
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={itemRow.unitCost}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unitCost: event.target.value } : row,
                      ),
                    }))
                  }
                  className="surface-input-soft"
                  placeholder="Price"
                />
                <input
                  value={itemRow.batchNumber}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, batchNumber: event.target.value } : row,
                      ),
                    }))
                  }
                  className="surface-input-soft"
                  placeholder="Batch / lot"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      items:
                        current.items.length === 1
                          ? current.items
                          : current.items.filter((_, rowIndex) => rowIndex !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Remarks</span>
            <textarea
              rows={4}
              value={formState.remarks}
              onChange={(event) => setFormState((current) => ({ ...current, remarks: event.target.value }))}
              className="surface-textarea-soft"
              placeholder="Reason for transfer, receiving point, or operational notes"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransferMutation.isPending}>
              {createTransferMutation.isPending ? 'Saving...' : 'Save Transfer'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer
        title={receiptState ? `Transfer Receipt - ${receiptState.transferNumber}` : 'Transfer Receipt'}
        open={isReceiptDrawerOpen}
        onClose={() => {
          setIsReceiptDrawerOpen(false);
          setReceiptError(null);
          setReceiptState(null);
        }}
      >
        <form className="space-y-5" onSubmit={handleReceiptSubmit}>
          {receiptError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {receiptError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {receiptState?.status === 'APPROVED'
              ? 'This action will dispatch the approved transfer and then receive only the quantities entered below.'
              : 'Receive the remaining in-transit quantities below. Enter zero for lines that must stay in transit.'}
          </div>

          <div className="space-y-4">
            {receiptState?.lines.map((line) => (
              <div key={line.transferItemId} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brown">{line.itemName}</p>
                    <p className="text-xs text-muted">{line.itemCode || line.itemId}</p>
                  </div>
                  <div className="grid gap-1 text-right text-xs text-muted sm:grid-cols-4 sm:gap-3">
                    <span>Requested {line.quantityRequested.toFixed(3)}</span>
                    <span>Sent {line.quantitySent.toFixed(3)}</span>
                    <span>Received {line.quantityReceived.toFixed(3)}</span>
                    <span>Remaining {line.remainingQuantity.toFixed(3)}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[180px_140px_1fr]">
                  <label className="space-y-2 text-sm text-muted">
                    <span>Receipt quantity</span>
                    <input
                      className="surface-input-soft"
                      max={line.remainingQuantity}
                      min="0"
                      step="0.001"
                      type="number"
                      value={line.receiptQuantity}
                      onChange={(event) =>
                        setReceiptState((current) => (
                          current
                            ? {
                                ...current,
                                lines: current.lines.map((entry) => (
                                  entry.transferItemId === line.transferItemId
                                    ? { ...entry, receiptQuantity: event.target.value }
                                    : entry
                                )),
                              }
                            : current
                        ))
                      }
                    />
                  </label>
                  <div className="space-y-2 text-sm text-muted">
                    <span>Unit cost</span>
                    <div className="surface-input-soft flex h-10 items-center">{line.unitCost.toFixed(2)}</div>
                  </div>
                  <div className="space-y-2 text-sm text-muted">
                    <span>Receipt value</span>
                    <div className="surface-input-soft flex h-10 items-center">
                      {(Math.max(0, Number(line.receiptQuantity) || 0) * line.unitCost).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsReceiptDrawerOpen(false);
                setReceiptError(null);
                setReceiptState(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pendingAction === `complete:${receiptState?.transferId ?? ''}`}>
              {pendingAction === `complete:${receiptState?.transferId ?? ''}` ? 'Posting...' : 'Post Receipt'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <div className="surface-card">
        <div className="flex items-center gap-3">
          <MoveRight className="h-5 w-5 text-orange" />
          <h2 className="text-lg font-semibold text-brown">Transfer discipline</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
            <div className="flex items-center gap-2 text-brown">
              <ArrowRightLeft className="h-4 w-4 text-orange" />
              Warehouse to warehouse
            </div>
            <p className="mt-2">Every transfer now starts with a clear source and destination warehouse pairing.</p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
            <div className="flex items-center gap-2 text-brown">
              <Package2 className="h-4 w-4 text-orange" />
              Posted on completion
            </div>
            <p className="mt-2">Stock only dispatches and receipts only post through the transfer completion workflow.</p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
            <div className="flex items-center gap-2 text-brown">
              <Truck className="h-4 w-4 text-orange" />
              Traceable actions
            </div>
            <p className="mt-2">Draft, approval, in-transit, partial receipt, completion, and cancellation are surfaced directly on the transfer list.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
