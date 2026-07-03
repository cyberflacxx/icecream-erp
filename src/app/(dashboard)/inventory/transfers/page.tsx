'use client';

import Link from 'next/link';
import { ArrowRightLeft, MoveRight, Package2, Plus, Truck } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, PermissionGate, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
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

function formatTransferStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function TransfersPage() {
  const canCreateTransfer = usePermission(PERMISSIONS.stockTransfer.create);
  const canApproveTransfer = usePermission(['inventory.transfer.approve', 'inventory.write', 'stock_transfer.approve']);
  const canCompleteTransfer = usePermission(['inventory.transfer.complete', 'inventory.write', 'stock_transfer.approve']);
  const canCancelTransfer = usePermission(['inventory.transfer.cancel', 'inventory.write', 'stock_transfer.approve']);
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

  const metaQuery = useInventoryMeta();
  const transfersQuery = useTransfers({
    fromWarehouseId: filters.fromWarehouseId || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
    toWarehouseId: filters.toWarehouseId || undefined,
  });
  const createTransferMutation = useCreateTransfer();

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
            render: (row) => <StatusBadge status={formatTransferStatus(row.status)} />,
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
                {canCompleteTransfer && row.status === 'APPROVED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction === `complete:${row.id}`}
                    onClick={() =>
                      void runTransferAction(`complete:${row.id}`, 'Transfer completed and inventory posted.', async () => {
                        await request(`/api/inventory/transfers/${row.id}/complete`, { method: 'POST' });
                      })
                    }
                  >
                    {pendingAction === `complete:${row.id}` ? 'Completing...' : 'Complete'}
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
            Save transfers as drafts when users are still preparing them, then move through approval and only post stock on completion.
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
                {transferStatusOptions.map((option) => (
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
                <select
                  value={itemRow.itemId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, itemId: event.target.value } : row,
                      ),
                    }))
                  }
                  className="surface-input-soft"
                >
                  <option value="">Select item</option>
                  {metaQuery.data?.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
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
            <p className="mt-2">Stock only deducts and receipts only post when the transfer reaches completion.</p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted">
            <div className="flex items-center gap-2 text-brown">
              <Truck className="h-4 w-4 text-orange" />
              Traceable actions
            </div>
            <p className="mt-2">Draft, approval, completion, and cancellation are surfaced directly on the transfer list.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
