'use client';

import Link from 'next/link';
import { MoveRight, Plus, Truck } from 'lucide-react';
import { type FormEvent, useState } from 'react';

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
  type StockTransferRow
} from '@/hooks/inventory';
import { usePermission } from '@/hooks/usePermission';

const transferStatusOptions = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' }
] as const;

const initialTransferForm = {
  fromWarehouseId: '',
  items: [
    {
      itemId: '',
      quantity: '0'
    }
  ],
  notes: '',
  toWarehouseId: ''
};

function formatTransferStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function TransfersPage() {
  const canCreateTransfer = usePermission(PERMISSIONS.stockTransfer.create);
  const [filters, setFilters] = useState({
    fromWarehouseId: '',
    page: 1,
    pageSize: 10,
    status: '',
    toWarehouseId: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialTransferForm);
  const [formError, setFormError] = useState<string | null>(null);

  const metaQuery = useInventoryMeta();
  const transfersQuery = useTransfers({
    fromWarehouseId: filters.fromWarehouseId || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
    toWarehouseId: filters.toWarehouseId || undefined
  });
  const createTransferMutation = useCreateTransfer();

  const transfers = transfersQuery.data?.data ?? [];
  const pagination = transfersQuery.data?.pagination;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validItems = formState.items
      .filter((item) => item.itemId)
      .map((item) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity)
      }));

    if (!formState.fromWarehouseId || !formState.toWarehouseId) {
      setFormError('Both source and destination warehouses are required.');
      return;
    }

    if (formState.fromWarehouseId === formState.toWarehouseId) {
      setFormError('Source and destination warehouses must be different.');
      return;
    }

    if (!validItems.length || validItems.some((item) => Number.isNaN(item.quantity) || item.quantity <= 0)) {
      setFormError('Add at least one item row with a quantity greater than zero.');
      return;
    }

    setFormError(null);

    try {
      await createTransferMutation.mutateAsync({
        fromWarehouseId: formState.fromWarehouseId,
        items: validItems,
        notes: formState.notes || null,
        toWarehouseId: formState.toWarehouseId
      });
      setFormState(initialTransferForm);
      setIsDrawerOpen(false);
      setFilters((current) => ({
        ...current,
        page: 1
      }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create stock transfer.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description="Move stock between warehouses with a single transaction that deducts from the source, adds to the destination, and leaves a complete movement trail behind."
        actions={
          <PermissionGate permission={PERMISSIONS.stockTransfer.create}>
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Transfer
            </Button>
          </PermissionGate>
        }
      />

      <InventoryNav />

      <FilterBar
        filters={[
          {
            key: 'fromWarehouseId',
            label: 'From warehouse',
            type: 'select',
            value: filters.fromWarehouseId,
            options:
              metaQuery.data?.warehouses.map((warehouse) => ({
                label: warehouse.name,
                value: warehouse.id
              })) ?? []
          },
          {
            key: 'toWarehouseId',
            label: 'To warehouse',
            type: 'select',
            value: filters.toWarehouseId,
            options:
              metaQuery.data?.warehouses.map((warehouse) => ({
                label: warehouse.name,
                value: warehouse.id
              })) ?? []
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: filters.status,
            options: [...transferStatusOptions]
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

      <DataTable<StockTransferRow>
        data={transfers}
        loading={transfersQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'transferNumber', header: 'Transfer #' },
          {
            key: 'fromWarehouse',
            header: 'From',
            render: (row) => row.fromWarehouse.name
          },
          {
            key: 'toWarehouse',
            header: 'To',
            render: (row) => row.toWarehouse.name
          },
          {
            key: 'transferDate',
            header: 'Date',
            render: (row) => new Date(row.transferDate).toLocaleString()
          },
          {
            key: 'itemsCount',
            header: 'Items Count',
            render: (row) => String(row.itemsCount)
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={formatTransferStatus(row.status)} />
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {row.notes ? <StatusBadge status="Has Notes" variant="info" /> : null}
                <Button asChild size="sm" variant="outline">
                  <Link href="/inventory/stock-movements">View Trail</Link>
                </Button>
              </div>
            )
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="No transfers found"
            description="Create the first inter-warehouse transfer when stock needs to move between production, cold rooms, or branch stores."
            action={
              canCreateTransfer ? (
                <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
                  Create transfer
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
              page
            }))
          }
        />
      ) : null}

      <FormDrawer title="New Stock Transfer" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>From warehouse</span>
              <select
                required
                value={formState.fromWarehouseId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, fromWarehouseId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
              <span>To warehouse</span>
              <select
                required
                value={formState.toWarehouseId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, toWarehouseId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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

          <div className="space-y-4 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Transfer items</p>
                <p className="mt-1 text-sm text-muted">Add one or more inventory lines to move.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    items: [...current.items, { itemId: '', quantity: '0' }]
                  }))
                }
              >
                Add Row
              </Button>
            </div>

            <div className="space-y-3">
              {formState.items.map((itemRow, index) => (
                <div key={`${index}-${itemRow.itemId}`} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <select
                    value={itemRow.itemId}
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
                    {metaQuery.data?.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    min="0"
                    step="0.001"
                    type="number"
                    value={itemRow.quantity}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        items: current.items.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, quantity: event.target.value } : row,
                        )
                      }))
                    }
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
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
                            : current.items.filter((_, rowIndex) => rowIndex !== index)
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              rows={4}
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransferMutation.isPending}>
              {createTransferMutation.isPending ? 'Processing...' : 'Submit Transfer'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <MoveRight className="h-5 w-5 text-orange" />
          <h2 className="text-lg font-semibold text-brown">Transfer discipline</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Each transfer completes in one transaction. If any item line fails stock checks, the source deduction and
          destination receipt both roll back together.
        </p>
      </div>
    </div>
  );
}
