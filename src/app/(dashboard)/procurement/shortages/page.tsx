'use client';

import { ShieldAlert } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { useSupplierShortages } from '@/hooks/procurement';

export default function ProcurementShortagesPage() {
  const query = useSupplierShortages();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Shortages"
        description="Keep under-delivered supplier obligations visible until they are fully resolved or cancelled."
      />
      <ProcurementNav />
      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'supplierName', header: 'Supplier' },
          { key: 'poNumber', header: 'PO #' },
          { key: 'itemName', header: 'Item' },
          { key: 'orderedQuantity', header: 'Ordered', render: (row) => row.orderedQuantity.toFixed(3) },
          { key: 'receivedQuantity', header: 'Received', render: (row) => row.receivedQuantity.toFixed(3) },
          { key: 'shortageQuantity', header: 'Shortage', render: (row) => row.shortageQuantity.toFixed(3) },
          { key: 'ageInDays', header: 'Age (days)' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} variant="warning" /> },
        ]}
        emptyState={<EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No supplier shortages" description="Shortages will appear here when received quantities are below ordered quantities." />}
      />
    </div>
  );
}
