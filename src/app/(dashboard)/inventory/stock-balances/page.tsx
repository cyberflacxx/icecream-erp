'use client';

import { AlertTriangle, Boxes, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

import { DataTable, EmptyState, FilterBar, StatusBadge } from '@/components/ui-library';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  useExpiringBatches,
  useInventoryMeta,
  useLowStock,
  useStockBalances,
  type StockBalanceRow
} from '@/hooks/inventory';

const quantityFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

const itemTypeOptions = [
  { label: 'Raw Material', value: 'RAW_MATERIAL' },
  { label: 'Packaging Material', value: 'PACKAGING_MATERIAL' },
  { label: 'Finished Good', value: 'FINISHED_GOOD' },
  { label: 'Consumable', value: 'CONSUMABLE' },
  { label: 'Spare Part', value: 'SPARE_PART' },
  { label: 'Work In Progress', value: 'WORK_IN_PROGRESS' }
] as const;

function getStockBadge(row: StockBalanceRow) {
  if (row.quantityAvailable === 0) {
    return {
      status: 'Out of Stock',
      variant: 'error' as const
    };
  }

  if (row.quantityAvailable <= row.item.reorderLevel) {
    return {
      status: 'Low Stock',
      variant: 'warning' as const
    };
  }

  return {
    status: 'OK',
    variant: 'success' as const
  };
}

export default function StockBalancesPage() {
  const [filters, setFilters] = useState({
    itemType: '',
    lowStock: false,
    page: 1,
    pageSize: 10,
    warehouseId: ''
  });

  const metaQuery = useInventoryMeta();
  const balancesQuery = useStockBalances({
    itemType: filters.itemType || undefined,
    lowStock: filters.lowStock || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    warehouseId: filters.warehouseId || undefined
  });
  const lowStockQuery = useLowStock();
  const expiringQuery = useExpiringBatches(30);

  const balances = balancesQuery.data?.data ?? [];
  const pagination = balancesQuery.data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Balances"
        description="Track live on-hand, reserved, and available inventory by warehouse before shortages create production or branch service failures."
      />

      <InventoryNav />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Low stock</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{lowStockQuery.data?.length ?? 0}</p>
          <p className="mt-2 text-sm text-muted">Items already at or below reorder threshold.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Expiring soon</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{expiringQuery.data?.length ?? 0}</p>
          <p className="mt-2 text-sm text-muted">Batches expiring within the next 30 days.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Visible balances</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{pagination?.total ?? 0}</p>
          <p className="mt-2 text-sm text-muted">Current filtered stock positions across the organization.</p>
        </div>
      </div>

      <FilterBar
        filters={[
          {
            key: 'warehouseId',
            label: 'Warehouse',
            type: 'select',
            value: filters.warehouseId,
            options:
              metaQuery.data?.warehouses.map((warehouse) => ({
                label: warehouse.name,
                value: warehouse.id
              })) ?? []
          },
          {
            key: 'itemType',
            label: 'Item type',
            type: 'select',
            value: filters.itemType,
            options: [...itemTypeOptions]
          },
          {
            key: 'lowStock',
            label: 'Low stock only',
            type: 'checkbox',
            checked: filters.lowStock
          }
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: key === 'lowStock' ? value === 'true' : value,
            page: 1
          }))
        }
      />

      <DataTable<StockBalanceRow>
        data={balances}
        loading={balancesQuery.isLoading}
        pagination={pagination}
        columns={[
          {
            key: 'itemCode',
            header: 'Item Code',
            render: (row) => row.item.code
          },
          {
            key: 'itemName',
            header: 'Item Name',
            render: (row) => row.item.name
          },
          {
            key: 'warehouse',
            header: 'Warehouse',
            render: (row) => row.warehouse.name
          },
          {
            key: 'quantityOnHand',
            header: 'On Hand',
            render: (row) => quantityFormatter.format(row.quantityOnHand)
          },
          {
            key: 'quantityReserved',
            header: 'Reserved',
            render: (row) => quantityFormatter.format(row.quantityReserved)
          },
          {
            key: 'quantityAvailable',
            header: 'Available',
            render: (row) => quantityFormatter.format(row.quantityAvailable)
          },
          {
            key: 'reorderLevel',
            header: 'Reorder Level',
            render: (row) => quantityFormatter.format(row.item.reorderLevel)
          },
          {
            key: 'status',
            header: 'Status Badge',
            render: (row) => {
              const badge = getStockBadge(row);

              return <StatusBadge status={badge.status} variant={badge.variant} />;
            }
          },
          {
            key: 'lastUpdated',
            header: 'Last Updated',
            render: (row) => format(new Date(row.lastUpdated), 'dd MMM yyyy HH:mm')
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Boxes className="h-6 w-6" />}
            title="No stock balances match these filters"
            description="Try another warehouse or item type filter to review live balances again."
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-brown">Low stock pressure points</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(lowStockQuery.data ?? []).slice(0, 4).map((row) => (
              <div key={row.id} className="rounded-2xl bg-cream px-4 py-3">
                <p className="font-medium text-brown">{row.item.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {row.warehouse.name}: {quantityFormatter.format(row.quantityAvailable)} available against reorder level{' '}
                  {quantityFormatter.format(row.item.reorderLevel)}.
                </p>
              </div>
            ))}
            {!lowStockQuery.data?.length ? (
              <p className="text-sm text-muted">No low stock items are visible for the current user scope.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-orange" />
            <h2 className="text-lg font-semibold text-brown">Expiry watchlist</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(expiringQuery.data ?? []).slice(0, 4).map((batch) => (
              <div key={batch.id} className="rounded-2xl bg-cream px-4 py-3">
                <p className="font-medium text-brown">{batch.item.name}</p>
                <p className="mt-1 text-sm text-muted">
                  Batch {batch.batchNumber} in {batch.warehouse.name} expires{' '}
                  {batch.expiryDate ? format(new Date(batch.expiryDate), 'dd MMM yyyy') : 'soon'}.
                </p>
              </div>
            ))}
            {!expiringQuery.data?.length ? (
              <p className="text-sm text-muted">No active batches are due to expire within 30 days.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
