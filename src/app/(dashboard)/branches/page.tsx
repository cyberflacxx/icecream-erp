'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { useBranches } from '@/hooks/branch-operations';
import { useUsers } from '@/hooks/settings/useSettings';
import { usePermission } from '@/hooks/usePermission';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency',
});

const inputClass = 'surface-input';

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const canManage = usePermission(PERMISSIONS.settings.manage);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 9,
    search: '',
    status: '',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    phone: '',
    address: '',
    managerId: '',
  });

  const branchesQuery = useBranches(filters);
  const managerQuery = useUsers({ page: 1, pageSize: 100, status: 'active' });
  const branches = branchesQuery.data?.data ?? [];
  const pagination = branchesQuery.data?.pagination;
  const managers = useMemo(
    () =>
      (managerQuery.data?.data ?? []).map((user) => ({
        id: user.id,
        label: `${user.fullName} (${user.workId})`,
      })),
    [managerQuery.data],
  );

  async function handleCreateBranch() {
    setErrorMessage(null);
    if (!form.code.trim() || !form.name.trim()) {
      setErrorMessage('Branch code and branch name are required.');
      return;
    }

    setIsCreating(true);
    try {
      await apiFetch('/api/branches', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          managerId: form.managerId || undefined,
          status: 'ACTIVE',
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['branch-operations', 'branches'] });
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey)
          && query.queryKey[0] === 'selectors'
          && query.queryKey[1] === 'branches',
      });
      await queryClient.invalidateQueries({ queryKey: ['sales', 'meta'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
      setDrawerOpen(false);
      setForm({ code: '', name: '', phone: '', address: '', managerId: '' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create branch.');
    } finally {
      setIsCreating(false);
    }
  }

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
        description="Monitor branch status, assign managers, and create new branches."
        actions={
          <Button onClick={() => { setErrorMessage(null); setDrawerOpen(true); }} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Branch
          </Button>
        }
      />

      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search',
            placeholder: 'Branch name or code',
            type: 'search',
            value: filters.search,
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
              { label: 'Closed', value: 'CLOSED' },
            ],
            type: 'select',
            value: filters.status,
          },
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
            page: 1,
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
              className="surface-card transition hover:-translate-y-0.5 hover:shadow-md"
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
              page,
            }))
          }
        />
      ) : null}

      <FormDrawer title="Create Branch" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
            <span>Branch Code</span>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="e.g. BR-011"
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
            <span>Branch Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Chitungwiza Branch"
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="e.g. +263..."
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
            <span>Address</span>
            <textarea
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Branch address"
              className="surface-textarea-soft min-h-24"
            />
          </label>

          <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
            <span>Assigned Manager</span>
            <select
              value={form.managerId}
              onChange={(event) => setForm((current) => ({ ...current, managerId: event.target.value }))}
              className={inputClass}
            >
              <option value="">Select manager later</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.label}
                </option>
              ))}
            </select>
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <Button onClick={handleCreateBranch} disabled={isCreating} className="w-full">
            {isCreating ? 'Creating...' : 'Create Branch'}
          </Button>
        </div>
      </FormDrawer>
    </div>
  );
}
