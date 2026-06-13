'use client';

import { Undo2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { useSupplierReturns } from '@/hooks/procurement';

export default function ProcurementReturnsPage() {
  const query = useSupplierReturns();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Returns"
        description="Review goods sent back to suppliers with QC status, return reason, and current workflow state."
      />
      <ProcurementNav />
      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'returnNumber', header: 'Return #' },
          { key: 'supplierName', header: 'Supplier' },
          { key: 'itemName', header: 'Item' },
          { key: 'quantityReturned', header: 'Qty', render: (row) => row.quantityReturned.toFixed(3) },
          { key: 'reason', header: 'Reason' },
          { key: 'qcStatus', header: 'QC', render: (row) => row.qcStatus ? <StatusBadge status={row.qcStatus} /> : '-' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        ]}
        emptyState={<EmptyState icon={<Undo2 className="h-6 w-6" />} title="No supplier returns found" description="Returns raised from rejected or failed goods receipts will appear here." />}
      />
    </div>
  );
}
