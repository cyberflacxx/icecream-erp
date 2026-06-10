'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, FilterBar, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { useBranches } from '@/hooks/branch-operations';
import { usePermission } from '@/hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

export default function BranchesPage() {
  const canManage = usePermission(PERMISSIONS.settings.manage);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 9,
    search: '',
    status: ''
  });
  const branchesQuery = useBranches(filters);
  const branches = branchesQuery.data?.data ?? [];
  const pagination = branchesQuery.data?.pagination;

  if (!canManage) {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="Admin access required"
        description="Only admins can manage all branches from this page."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Monitor branch status, manager ownership, and today's high-level performance."
      />

      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search',
            placeholder: 'Branch name or code',
            type: 'search',
            value: filters.search
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
              { label: 'Closed', value: 'CLOSED' }
            ],
            type: 'select',
            value: filters.status
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

      {branches.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No branches found"
          description="Create and activate branches to start branch-level operations."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/branches/${branch.id}`}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">{branch.code}</p>
                  <h3 className="mt-1 text-lg font-semibold text-brown">{branch.name}</h3>
                </div>
                <StatusBadge status={branch.status} />
              </div>

              <div className="mt-4 space-y-1 text-sm text-muted">
                <p>Manager: {branch.manager?.name ?? 'Not assigned'}</p>
                <p>Phone: {branch.phone ?? 'Not set'}</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-cream p-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Today Sales</p>
                  <p className="mt-1 font-semibold text-brown">{currencyFormatter.format(branch.todaySales)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Stock Status</p>
                  <p className="mt-1 font-semibold text-brown">{branch.stockStatus}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

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
    </div>
  );
}
