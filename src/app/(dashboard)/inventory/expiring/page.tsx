'use client';

import { useState } from 'react';
import { ClockAlert } from 'lucide-react';

import { DataTable, EmptyState, FilterBar, LoadingState, StatusBadge } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { useExpiringBatches } from '@/hooks/inventory/useExpiringBatches';
import { type ExpiringBatchRow } from '@/hooks/inventory/types';

export default function ExpiringInventoryPage() {
  const [days, setDays] = useState(30);
  const expiringQuery = useExpiringBatches(days);

  if (expiringQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expiring Batches"
        description="Track batches nearing expiry and prioritize stock rotation."
      />

      <FilterBar
        filters={[
          {
            key: 'days',
            label: 'Days Ahead',
            type: 'select',
            value: String(days),
            options: [
              { label: '7 Days', value: '7' },
              { label: '14 Days', value: '14' },
              { label: '30 Days', value: '30' },
              { label: '60 Days', value: '60' }
            ]
          }
        ]}
        onFilterChange={(_key, value) => setDays(Number(value))}
      />

      <DataTable
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'item', header: 'Item', render: (row: ExpiringBatchRow) => row.item?.name ?? 'N/A' },
          { key: 'warehouse', header: 'Warehouse', render: (row: ExpiringBatchRow) => row.warehouse?.name ?? 'N/A' },
          { key: 'quantityRemaining', header: 'Qty Remaining' },
          { key: 'expiryDate', header: 'Expiry Date' },
          {
            key: 'status',
            header: 'Status',
            render: (row: ExpiringBatchRow) => <StatusBadge status={String(row.status)} />
          }
        ]}
        data={expiringQuery.data ?? []}
        emptyState={
          <EmptyState
            icon={<ClockAlert className="h-6 w-6" />}
            title="No expiring batches"
            description="No batches are expiring within the selected timeframe."
          />
        }
      />
    </div>
  );
}
