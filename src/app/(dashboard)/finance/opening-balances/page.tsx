'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { AlertCircle, ClipboardList, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, FormDrawer, LoadingState } from '@/components/ui-library';
import { useFinanceMeta, useFinanceMutation, useOpeningBalances } from '@/hooks/finance/useFinanceResources';
import { usePermission } from '@/hooks/usePermission';
import { API_ROUTES } from '@/lib/shared';

type OpeningBalanceFormState = {
  accountId: string;
  branchId: string;
  costCenterCode: string;
  creditAmount: string;
  currencyCode: string;
  debitAmount: string;
  effectiveDate: string;
  notes: string;
  reference: string;
};

const DEFAULT_FORM_STATE: OpeningBalanceFormState = {
  accountId: '',
  branchId: '',
  costCenterCode: '',
  creditAmount: '0',
  currencyCode: 'USD',
  debitAmount: '0',
  effectiveDate: '2026-08-01',
  notes: '',
  reference: '',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
});

export default function FinanceOpeningBalancesPage() {
  const canWrite = usePermission(['finance.write', 'finance.gl.post']);
  const metaQuery = useFinanceMeta();
  const query = useOpeningBalances();
  const createDraft = useFinanceMutation(API_ROUTES.FINANCE.OPENING_BALANCES);
  const postDrafts = useFinanceMutation(API_ROUTES.FINANCE.OPENING_BALANCES_POST);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<OpeningBalanceFormState>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);
  const [postingDate, setPostingDate] = useState('2026-08-01');

  const draftLines = useMemo(
    () => (query.data ?? []).filter((row) => String(row.postingStatus ?? '').toUpperCase() === 'DRAFT'),
    [query.data],
  );
  const draftTotals = useMemo(() => ({
    credit: draftLines.reduce((sum, row) => sum + Number(row.creditAmount ?? 0), 0),
    debit: draftLines.reduce((sum, row) => sum + Number(row.debitAmount ?? 0), 0),
  }), [draftLines]);

  function resetForm() {
    setDrawerOpen(false);
    setFormError(null);
    setFormState(DEFAULT_FORM_STATE);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      await createDraft.mutateAsync({
        accountId: formState.accountId,
        branchId: formState.branchId || null,
        costCenterCode: formState.costCenterCode || null,
        creditAmount: Number(formState.creditAmount) || 0,
        currencyCode: formState.currencyCode || 'USD',
        debitAmount: Number(formState.debitAmount) || 0,
        effectiveDate: formState.effectiveDate,
        notes: formState.notes || null,
        reference: formState.reference || null,
      });
      resetForm();
      void query.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create opening balance line.');
    }
  }

  async function handlePostDrafts() {
    try {
      setFormError(null);
      await postDrafts.mutateAsync({ effectiveDate: postingDate });
      void query.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to post opening balances.');
    }
  }

  if (query.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (query.isError || metaQuery.isError || !query.data || !metaQuery.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Opening balances unavailable"
        description="The finance opening-balance workspace could not be loaded right now."
        actionLabel="Retry"
        onAction={() => {
          void query.refetch();
          void metaQuery.refetch();
        }}
      />
    );
  }

  const postingAccounts = (metaQuery.data.accounts ?? []).filter((account) => account.allowPosting !== false);
  const branches = metaQuery.data.branches ?? [];
  const costCentres = metaQuery.data.costCentres ?? [];
  const currencies = (metaQuery.data.currencies ?? []).filter((currency) => currency.isActive !== false);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Opening Balances"
        description="Capture balanced opening lines, review drafts, and post them into the ledger by effective date."
        status="partial"
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handlePostDrafts} disabled={postDrafts.isPending}>
                {postDrafts.isPending ? 'Posting...' : 'Post Drafts'}
              </Button>
              <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Line
              </Button>
            </div>
          ) : undefined
        }
      />
      <FinanceNav />

      <section className="grid gap-4 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 lg:grid-cols-[220px_1fr_1fr]">
        <label className="space-y-2 text-sm text-muted">
          <span>Posting Date</span>
          <input
            type="date"
            value={postingDate}
            onChange={(event) => setPostingDate(event.target.value)}
            className="surface-input-soft"
          />
        </label>
        <div className="rounded-lg border border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-text)]">
          Draft Debit: <strong>{currencyFormatter.format(draftTotals.debit)}</strong>
        </div>
        <div className="rounded-lg border border-[color:var(--app-border)] px-4 py-3 text-sm text-[color:var(--app-text)]">
          Draft Credit: <strong>{currencyFormatter.format(draftTotals.credit)}</strong>
        </div>
      </section>

      {formError ? (
        <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {formError}
        </div>
      ) : null}

      <DataTable
        columns={[
          { key: 'effectiveDate', header: 'Effective Date' },
          { key: 'accountCode', header: 'Code' },
          { key: 'accountName', header: 'Account' },
          { key: 'debitAmount', header: 'Debit', render: (row) => currencyFormatter.format(Number(row.debitAmount ?? 0)) },
          { key: 'creditAmount', header: 'Credit', render: (row) => currencyFormatter.format(Number(row.creditAmount ?? 0)) },
          { key: 'currencyCode', header: 'Currency' },
          { key: 'costCenterCode', header: 'Cost Centre' },
          { key: 'postingStatus', header: 'Status' },
          { key: 'reference', header: 'Reference' },
        ]}
        data={query.data}
        emptyState={
          <FinanceEmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No opening balances found."
            description="Create draft opening-balance lines before posting them into finance."
            actionLabel={canWrite ? 'Create Line' : undefined}
            onAction={canWrite ? () => setDrawerOpen(true) : undefined}
          />
        }
      />

      <FormDrawer title="New Opening Balance Line" open={drawerOpen} onClose={resetForm}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Account</span>
              <select
                required
                value={formState.accountId}
                onChange={(event) => setFormState((current) => ({ ...current, accountId: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">Select account</option>
                {postingAccounts.map((account) => (
                  <option key={String(account.id)} value={String(account.id)}>
                    {String(account.account_code ?? account.code ?? '')} - {String(account.account_name ?? account.name ?? '')}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Effective Date</span>
              <input
                required
                type="date"
                value={formState.effectiveDate}
                onChange={(event) => setFormState((current) => ({ ...current, effectiveDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Debit Amount</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={formState.debitAmount}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    creditAmount: Number(event.target.value) > 0 ? '0' : current.creditAmount,
                    debitAmount: event.target.value,
                  }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Credit Amount</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={formState.creditAmount}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    creditAmount: event.target.value,
                    debitAmount: Number(event.target.value) > 0 ? '0' : current.debitAmount,
                  }))
                }
                className="surface-input-soft"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Branch</span>
              <select
                value={formState.branchId}
                onChange={(event) => setFormState((current) => ({ ...current, branchId: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">No branch</option>
                {branches.map((branch) => (
                  <option key={String(branch.id)} value={String(branch.id)}>
                    {String(branch.name ?? branch.code ?? '')}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Cost Centre</span>
              <select
                value={formState.costCenterCode}
                onChange={(event) => setFormState((current) => ({ ...current, costCenterCode: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">No cost centre</option>
                {costCentres.map((costCentre) => (
                  <option key={String(costCentre.id)} value={String(costCentre.code ?? '')}>
                    {String(costCentre.code ?? '')} - {String(costCentre.name ?? '')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Currency</span>
              <select
                value={formState.currencyCode}
                onChange={(event) => setFormState((current) => ({ ...current, currencyCode: event.target.value }))}
                className="surface-input-soft"
              >
                {currencies.length === 0 ? <option value="USD">USD</option> : null}
                {currencies.map((currency) => (
                  <option key={String(currency.id)} value={String(currency.code ?? 'USD')}>
                    {String(currency.code ?? 'USD')}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Reference</span>
              <input
                value={formState.reference}
                onChange={(event) => setFormState((current) => ({ ...current, reference: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              rows={3}
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDraft.isPending}>
              {createDraft.isPending ? 'Saving...' : 'Save Line'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
