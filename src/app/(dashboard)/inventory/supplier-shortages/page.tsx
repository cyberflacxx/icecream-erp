'use client';

import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { useSupplierShortages } from '@/hooks/inventory';

export default function SupplierShortagesPage() {
  const [page, setPage] = useState(1);
  const query = useSupplierShortages({ page, pageSize: 10 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Shortages"
        description="Track purchase order shortfalls that still need supplier resolution before production plans are affected."
      />

      <InventoryNav />

      <DataTable
        data={query.data?.data ?? []}
        loading={query.isLoading}
        pagination={query.data?.pagination}
        columns={[
          { key: 'supplierName', header: 'Supplier', render: (row) => row.supplierName },
          { key: 'poNumber', header: 'PO Number', render: (row) => row.poNumber },
          { key: 'itemName', header: 'Item', render: (row) => row.itemName },
          { key: 'orderedQuantity', header: 'Ordered', render: (row) => row.orderedQuantity.toFixed(3) },
          { key: 'receivedQuantity', header: 'Received', render: (row) => row.receivedQuantity.toFixed(3) },
          { key: 'shortageQuantity', header: 'Shortage', render: (row) => row.shortageQuantity.toFixed(3) },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} variant={row.status === 'OPEN' ? 'warning' : 'success'} />,
          },
        ]}
        emptyState={
          <EmptyState
            icon={<ShieldAlert className="h-6 w-6" />}
            title="No supplier shortages are open"
            description="When a PO is under-received, the remaining supplier balance will appear here."
          />
        }
      />

      {query.data?.pagination ? (
        <PaginationControls
          page={query.data.pagination.page}
          pageSize={query.data.pagination.pageSize}
          total={query.data.pagination.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
