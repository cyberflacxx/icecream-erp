'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FilterBar, StatusBadge } from '@/components/ui-library';
import { useInventoryApprovals, useInventoryRequest } from '@/hooks/inventory';

export default function InventoryApprovalsPage() {
  const [status, setStatus] = useState('PENDING');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const query = useInventoryApprovals(status);
  const request = useInventoryRequest();
  const queryClient = useQueryClient();

  async function runApprovalAction(id: string, action: 'approve' | 'reject') {
    const comments = action === 'reject'
      ? window.prompt('Enter rejection notes')
      : window.prompt('Approval notes');

    if (action === 'reject' && !comments?.trim()) {
      setFeedback({ message: 'Rejection notes are required.', tone: 'error' });
      return;
    }

    setPendingAction(`${action}:${id}`);
    setFeedback(null);

    try {
      await request(`/api/inventory/approvals/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ comments: comments?.trim() || null }),
      });
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'approvals'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard'] });
      setFeedback({ message: action === 'approve' ? 'Approval request approved.' : 'Approval request rejected.', tone: 'success' });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Approval action failed.', tone: 'error' });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Approvals"
        description="Review stock transfers, adjustments, stock takes, and return workflows waiting for action, with direct context for where each request belongs."
      />

      <InventoryNav />

      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
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
            key: 'requestType',
            header: 'Request Type',
            render: (row) => <StatusBadge status={formatEntityType(row.requestType ?? row.entity_type)} variant="info" />,
          },
          { key: 'referenceNumber', header: 'Reference', render: (row) => row.referenceNumber ?? row.entity_id },
          { key: 'itemDescription', header: 'Description', render: (row) => row.itemDescription ?? 'Inventory approval' },
          { key: 'quantity', header: 'Quantity', render: (row) => row.quantity == null ? '-' : Number(row.quantity).toLocaleString(undefined, { maximumFractionDigits: 3 }) },
          { key: 'requestedBy', header: 'Requested By', render: (row) => row.requestedBy ?? row.requesterId ?? '-' },
          { key: 'requested_at', header: 'Requested', render: (row) => formatSafeDate(row.requestDate ?? row.requested_at) },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} variant={row.status === 'PENDING' ? 'warning' : 'success'} />,
          },
          { key: 'currentApprover', header: 'Current Approver', render: (row) => row.currentApprover ?? '-' },
          { key: 'actions', header: 'Actions Logged', render: (row) => row.actions?.length ?? 0 },
          {
            key: 'open',
            header: 'Actions',
            render: (row) => {
              const href = resolveApprovalHref(row.entity_type, row.entity_id);
              return (
                <div className="flex flex-wrap gap-2">
                  {href ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={href}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                  ) : null}
                  {row.canApprove ? (
                    <>
                      <Button size="sm" disabled={pendingAction === `approve:${row.id}`} onClick={() => void runApprovalAction(row.id, 'approve')}>
                        {pendingAction === `approve:${row.id}` ? 'Approving...' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={pendingAction === `reject:${row.id}`} onClick={() => void runApprovalAction(row.id, 'reject')}>
                        {pendingAction === `reject:${row.id}` ? 'Rejecting...' : 'Reject'}
                      </Button>
                    </>
                  ) : null}
                  {!href && !row.canApprove ? <span className="text-xs text-muted">No available action</span> : null}
                </div>
              );
            },
          },
        ]}
        emptyState={
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No inventory approvals found"
            description="There are no inventory approvals matching the selected filters."
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
  const normalized = entityType.replace(/^inventory\./i, '');
  if (normalized === 'stock_transfer') return '/inventory/transfers';
  if (normalized === 'goods_return') return '/quality/returns';
  if (normalized === 'stock_take' || normalized === 'inventory_stock_take') return '/inventory/reports';
  if (normalized === 'stock_adjustment') return '/inventory/stock-movements';
  if (normalized === 'branch_transfer') return `/branches/${entityId}`;
  return null;
}

function formatSafeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy HH:mm');
}
