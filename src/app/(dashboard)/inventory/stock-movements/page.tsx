'use client';

import { ArrowRightLeft, History } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

import { DataTable, EmptyState, FilterBar, StatusBadge } from '@/components/ui-library';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { useInventoryMeta, useStockMovements, type StockMovementRow } from '@/hooks/inventory';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});

const quantityFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

const movementTypeOptions = [
  'PURCHASE_RECEIVE',
  'PRODUCTION_ISSUE',
  'PRODUCTION_OUTPUT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'SALES_ISSUE',
  'RETURN_IN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'EXPIRY_WRITE_OFF'
].map((value) => ({
  label: value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()),
  value
}));

function formatLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function StockMovementsPage() {
  const [filters, setFilters] = useState({
    endDate: '',
    itemId: '',
    page: 1,
    pageSize: 10,
    startDate: '',
    type: '',
    warehouseId: ''
  });

  const metaQuery = useInventoryMeta();
  const movementsQuery = useStockMovements({
    endDate: filters.endDate || undefined,
    itemId: filters.itemId || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    startDate: filters.startDate || undefined,
    type: filters.type || undefined,
    warehouseId: filters.warehouseId || undefined
  });

  const movements = movementsQuery.data?.data ?? [];
  const pagination = movementsQuery.data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description="Review every receipt, issue, transfer, and adjustment recorded by the inventory engine, including who triggered it and the reference trail behind it."
      />

      <InventoryNav />

      <FilterBar
        filters={[
          {
            key: 'startDate',
            label: 'Start date',
            type: 'date',
            value: filters.startDate
          },
          {
            key: 'endDate',
            label: 'End date',
            type: 'date',
            value: filters.endDate
          },
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
            key: 'itemId',
            label: 'Item',
            type: 'select',
            value: filters.itemId,
            options:
              metaQuery.data?.items.map((item) => ({
                label: `${item.code} - ${item.name}`,
                value: item.id
              })) ?? []
          },
          {
            key: 'type',
            label: 'Movement type',
            type: 'select',
            value: filters.type,
            options: movementTypeOptions
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

      <DataTable<StockMovementRow>
        data={movements}
        loading={movementsQuery.isLoading}
        pagination={pagination}
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (row) => format(new Date(row.date), 'dd MMM yyyy HH:mm')
          },
          {
            key: 'item',
            header: 'Item',
            render: (row) => (
              <div>
                <p className="font-medium text-brown">{row.item.name}</p>
                <p className="text-xs text-muted">{row.item.code}</p>
              </div>
            )
          },
          {
            key: 'warehouse',
            header: 'Warehouse',
            render: (row) => row.warehouse.name
          },
          {
            key: 'type',
            header: 'Type Badge',
            render: (row) => <StatusBadge status={formatLabel(row.type)} variant="info" />
          },
          {
            key: 'quantity',
            header: 'Quantity',
            render: (row) => quantityFormatter.format(row.quantity)
          },
          {
            key: 'runningBalance',
            header: 'Running Balance',
            render: (row) => quantityFormatter.format(row.runningBalance)
          },
          {
            key: 'unitCost',
            header: 'Unit Cost',
            render: (row) => currencyFormatter.format(row.unitCost)
          },
          {
            key: 'reference',
            header: 'Reference',
            render: (row) => (
              <div>
                <p className="font-medium text-brown">{formatLabel(row.reference.type)}</p>
                <p className="text-xs text-muted">{row.reference.id}</p>
              </div>
            )
          },
          {
            key: 'createdBy',
            header: 'Created By',
            render: (row) => row.createdBy?.name || 'System'
          }
        ]}
        emptyState={
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No stock movements found"
            description="Clear or widen the filters to inspect the movement trail again."
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

      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-5 w-5 text-orange" />
          <h2 className="text-lg font-semibold text-brown">Audit trail posture</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Every inventory movement is tied to a user, a reference type, a reference id, and an exact timestamp.
          This table is the operational trail for production consumption, transfers, and valuation checks.
        </p>
      </div>
    </div>
  );
}
