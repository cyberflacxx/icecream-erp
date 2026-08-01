'use client';

import { type FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  FolderTree,
  Pencil,
  Plus,
  Power,
  Search,
} from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, FormDrawer, LoadingState } from '@/components/ui-library';
import { useChartOfAccounts, useFinanceMutation } from '@/hooks/finance/useFinanceResources';
import { usePermission } from '@/hooks/usePermission';
import {
  buildFinanceAccountTree,
  filterFinanceAccounts,
  flattenFinanceAccountTree,
  normalizeFinanceAccountRecord,
  type FinanceAccountType,
  FINANCE_ACCOUNT_TYPES,
} from '@/lib/finance-foundation';
import { API_ROUTES } from '@/lib/shared';

type ChartAccountRow = Record<string, unknown>;

type AccountFormState = {
  accountCode: string;
  accountName: string;
  accountType: FinanceAccountType;
  allowPosting: boolean;
  description: string;
  id: string | null;
  isActive: boolean;
  parentAccountId: string | null;
};

const DEFAULT_FORM_STATE: AccountFormState = {
  accountCode: '',
  accountName: '',
  accountType: 'ASSET',
  allowPosting: true,
  description: '',
  id: null,
  isActive: true,
  parentAccountId: null,
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
});

function mapRowToFormState(row: ChartAccountRow): AccountFormState {
  const accountType = String(row.account_type ?? row.type ?? 'ASSET').toUpperCase() as FinanceAccountType;
  return {
    accountCode: String(row.account_code ?? row.code ?? ''),
    accountName: String(row.account_name ?? row.name ?? ''),
    accountType,
    allowPosting: row.allow_posting === false || row.allowPosting === false ? false : true,
    description: String(row.description ?? ''),
    id: String(row.id ?? ''),
    isActive: row.is_active !== false && row.isActive !== false,
    parentAccountId: row.parent_account_id ? String(row.parent_account_id) : row.parent_id ? String(row.parent_id) : null,
  };
}

export default function ChartOfAccountsPage() {
  const canWrite = usePermission(['finance.write', 'finance.gl.create']);
  const query = useChartOfAccounts();
  const saveAccount = useFinanceMutation<unknown, Record<string, unknown>>(
    (payload) =>
      payload.id
        ? API_ROUTES.FINANCE.CHART_OF_ACCOUNT(String(payload.id))
        : API_ROUTES.FINANCE.CHART_OF_ACCOUNTS,
    {
      method: 'POST',
    },
  );
  const updateAccount = useFinanceMutation<unknown, Record<string, unknown>>(
    (payload) => API_ROUTES.FINANCE.CHART_OF_ACCOUNT(String(payload.id)),
    { method: 'PATCH' },
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<AccountFormState>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | FinanceAccountType>('ALL');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const accounts = useMemo(
    () => (query.data ?? []).map((row) => normalizeFinanceAccountRecord(row as Record<string, unknown>)),
    [query.data],
  );

  const filteredAccounts = useMemo(
    () =>
      filterFinanceAccounts(accounts, {
        activeStatus: activeFilter,
        search,
        type: typeFilter === 'ALL' ? null : typeFilter,
      }),
    [accounts, activeFilter, search, typeFilter],
  );

  const treeRows = useMemo(() => flattenFinanceAccountTree(buildFinanceAccountTree(filteredAccounts)), [filteredAccounts]);

  function resetForm() {
    setDrawerOpen(false);
    setFormError(null);
    setFormState(DEFAULT_FORM_STATE);
  }

  function openCreateForm() {
    setFormError(null);
    setFormState(DEFAULT_FORM_STATE);
    setDrawerOpen(true);
  }

  function openEditForm(row: ChartAccountRow) {
    setFormError(null);
    setFormState(mapRowToFormState(row));
    setDrawerOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const payload = {
      accountCode: formState.accountCode,
      accountName: formState.accountName,
      accountType: formState.accountType,
      allowPosting: formState.accountType === 'HEADER' ? false : formState.allowPosting,
      description: formState.description || null,
      id: formState.id,
      isActive: formState.isActive,
      parentAccountId: formState.parentAccountId,
    };

    try {
      if (formState.id) {
        await updateAccount.mutateAsync(payload);
      } else {
        const { id, ...createPayload } = payload;
        await saveAccount.mutateAsync(createPayload);
      }
      resetForm();
      void query.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save account.');
    }
  }

  async function handleToggleActive(row: ChartAccountRow) {
    try {
      await updateAccount.mutateAsync({
        accountName: String(row.account_name ?? row.name ?? ''),
        accountType: String(row.account_type ?? row.type ?? 'ASSET'),
        allowPosting: row.allow_posting === false || row.allowPosting === false ? false : true,
        description: row.description ?? null,
        id: String(row.id ?? ''),
        isActive: !(row.is_active !== false && row.isActive !== false),
        parentAccountId: row.parent_account_id ?? row.parent_id ?? null,
      });
      void query.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update account.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Accounts unavailable"
        description="Finance accounts could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chart of Accounts"
        description="Maintain the official chart hierarchy, posting rules, balances, and ledger access."
        status="partial"
        actions={
          canWrite ? (
            <Button type="button" size="sm" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Button>
          ) : undefined
        }
      />
      <FinanceNav />

      <section className="space-y-4 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account code or name"
              className="surface-input-soft w-full pl-9"
            />
          </label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'ALL' | FinanceAccountType)}
            className="surface-input-soft"
          >
            <option value="ALL">All types</option>
            {FINANCE_ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')}
            className="surface-input-soft"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text)]">
            <FolderTree className="h-4 w-4" />
            Account Tree
          </div>

          {treeRows.length === 0 ? (
            <FinanceEmptyState
              icon={<FolderTree className="h-6 w-6" />}
              title="No accounts match the current filters."
              description="Adjust the search or create the first finance account."
              actionLabel={canWrite ? 'Create Account' : undefined}
              onAction={canWrite ? openCreateForm : undefined}
            />
          ) : (
            <div className="space-y-1">
              {treeRows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-3 py-2 lg:grid-cols-[minmax(0,1.5fr)_160px_140px_120px_160px]"
                  style={{ paddingLeft: `${12 + row.depth * 20}px` }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[color:var(--app-text)]">
                      {row.accountCode} {row.accountName}
                    </div>
                    <div className="text-xs text-[color:var(--app-muted)]">
                      {row.allowPosting ? 'Posting account' : 'Header account'}
                    </div>
                  </div>
                  <div className="text-sm text-[color:var(--app-muted)]">{row.accountType.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-[color:var(--app-muted)]">{row.isActive ? 'Active' : 'Inactive'}</div>
                  <div className="text-sm text-[color:var(--app-muted)]">{currencyFormatter.format(row.currentBalance)}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild type="button" size="sm" variant="outline">
                      <Link href={`/finance/transactions?accountId=${row.id}`}>
                        <BookOpen className="mr-2 h-3.5 w-3.5" />
                        Ledger
                      </Link>
                    </Button>
                    {canWrite ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => openEditForm(row as unknown as ChartAccountRow)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleToggleActive(row as unknown as ChartAccountRow)}>
                          <Power className="mr-2 h-3.5 w-3.5" />
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <DataTable
        columns={[
          { key: 'accountCode', header: 'Code' },
          { key: 'accountName', header: 'Account' },
          { key: 'accountType', header: 'Type', render: (row) => String(row.accountType ?? '').replace(/_/g, ' ') },
          { key: 'parentAccountCode', header: 'Parent' },
          { key: 'allowPosting', header: 'Posting', render: (row) => (row.allowPosting ? 'Posting' : 'Header') },
          { key: 'isActive', header: 'Status', render: (row) => (row.isActive ? 'Active' : 'Inactive') },
          { key: 'currentBalance', header: 'Balance', render: (row) => currencyFormatter.format(Number(row.currentBalance ?? 0)) },
        ]}
        data={filteredAccounts}
        emptyState={
          <FinanceEmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="No accounts found."
            description="Create chart-of-accounts records to start tracking finance transactions."
            actionLabel={canWrite ? 'Create Account' : undefined}
            onAction={canWrite ? openCreateForm : undefined}
          />
        }
      />

      <FormDrawer title={formState.id ? 'Edit Account' : 'New Account'} open={drawerOpen} onClose={resetForm}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Account Code</span>
              <input
                required
                value={formState.accountCode}
                onChange={(event) => setFormState((current) => ({ ...current, accountCode: event.target.value.toUpperCase() }))}
                className="surface-input-soft"
                placeholder="1140"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Account Name</span>
              <input
                required
                value={formState.accountName}
                onChange={(event) => setFormState((current) => ({ ...current, accountName: event.target.value }))}
                className="surface-input-soft"
                placeholder="Accounts Receivable"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Account Type</span>
              <select
                value={formState.accountType}
                onChange={(event) => {
                  const nextType = event.target.value as FinanceAccountType;
                  setFormState((current) => ({
                    ...current,
                    accountType: nextType,
                    allowPosting: nextType === 'HEADER' ? false : current.allowPosting,
                  }));
                }}
                className="surface-input-soft"
              >
                {FINANCE_ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Parent Account</span>
              <select
                value={formState.parentAccountId ?? ''}
                onChange={(event) => setFormState((current) => ({ ...current, parentAccountId: event.target.value || null }))}
                className="surface-input-soft"
              >
                <option value="">No parent</option>
                {accounts
                  .filter((account) => !formState.id || account.id !== formState.id)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountCode} - {account.accountName}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Description</span>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-[color:var(--app-border)] px-3 py-2 text-sm text-[color:var(--app-text)]">
              <input
                type="checkbox"
                checked={formState.allowPosting}
                disabled={formState.accountType === 'HEADER'}
                onChange={(event) => setFormState((current) => ({ ...current, allowPosting: event.target.checked }))}
              />
              <span>{formState.accountType === 'HEADER' ? 'Header account' : 'Allow posting'}</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[color:var(--app-border)] px-3 py-2 text-sm text-[color:var(--app-text)]">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span>Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveAccount.isPending || updateAccount.isPending}>
              {saveAccount.isPending || updateAccount.isPending ? 'Saving...' : 'Save Account'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
