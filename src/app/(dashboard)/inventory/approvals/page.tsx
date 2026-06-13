'use client';

import { format } from 'date-fns';
import { ClipboardCheck } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { useInventoryApprovals } from '@/hooks/inventory';

export default function InventoryApprovalsPage() {
  const query = useInventoryApprovals();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Inventory Approvals"
        description="Review stock transfers, adjustments, stock takes, and return workflows waiting for backend approval."
      />

      <InventoryNav />

      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'entity_type', header: 'Entity Type', render: (row) => row.entity_type },
          { key: 'entity_id', header: 'Reference', render: (row) => row.entity_id },
          { key: 'current_step', header: 'Step', render: (row) => row.current_step },
          { key: 'requested_at', header: 'Requested', render: (row) => format(new Date(row.requested_at), 'dd MMM yyyy HH:mm') },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} variant={row.status === 'PENDING' ? 'warning' : 'success'} />,
          },
          { key: 'actions', header: 'Actions Logged', render: (row) => row.actions.length },
        ]}
        emptyState={
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No pending approvals"
            description="Approval requests created for inventory workflows will appear here until they are actioned."
          />
        }
      />
    </div>
  );
}
