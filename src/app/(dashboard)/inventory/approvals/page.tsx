'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FilterBar, StatusBadge } from '@/components/ui-library';
import { useInventoryApprovals } from '@/hooks/inventory';

export default function InventoryApprovalsPage() {
  const [status, setStatus] = useState('PENDING');
  const query = useInventoryApprovals(status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Approvals"
        description="Review stock transfers, adjustments, stock takes, and return workflows waiting for action, with direct context for where each request belongs."
      />

      <InventoryNav />

      <FilterBar
        filters={[
          {
            key: 'status',
            label: 'Approval status',
            type: 'select',
            value: status,
            options: [
              { label: 'Pending', value: 'PENDING' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Completed', value: 'COMPLETED' },
            ],
          },
        ]}
        onFilterChange={(_key, value) => setStatus(value)}
      />

      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          {
            key: 'entity_type',
            header: 'Entity Type',
            render: (row) => <StatusBadge status={formatEntityType(row.entity_type)} variant="info" />,
          },
          { key: 'entity_id', header: 'Reference', render: (row) => row.entity_id },
          { key: 'current_step', header: 'Step', render: (row) => row.current_step },
          { key: 'requested_at', header: 'Requested', render: (row) => format(new Date(row.requested_at), 'dd MMM yyyy HH:mm') },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} variant={row.status === 'PENDING' ? 'warning' : 'success'} />,
          },
          { key: 'actions', header: 'Actions Logged', render: (row) => row.actions.length },
          {
            key: 'open',
            header: 'Open Flow',
            render: (row) => {
              const href = resolveApprovalHref(row.entity_type, row.entity_id);
              return href ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={href}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </Link>
                </Button>
              ) : (
                <span className="text-xs text-muted">No direct page</span>
              );
            },
          },
        ]}
        emptyState={
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No approvals found"
            description="Approval requests created for inventory workflows will appear here when they match the selected status."
          />
        }
      />
    </div>
  );
}

function formatEntityType(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveApprovalHref(entityType: string, entityId: string) {
  if (entityType === 'stock_transfer') return '/inventory/transfers';
  if (entityType === 'goods_return') return '/quality/returns';
  if (entityType === 'stock_take') return '/inventory/reports';
  if (entityType === 'stock_adjustment') return '/inventory/stock-movements';
  if (entityType === 'branch_transfer') return `/branches/${entityId}`;
  return null;
}
