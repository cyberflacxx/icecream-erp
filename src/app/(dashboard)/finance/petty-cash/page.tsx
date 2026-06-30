'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useFinanceMeta, useFinanceMutation, usePettyCashRequests } from '@/hooks/finance/useFinanceResources';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinancePettyCashPage() {
  const query = usePettyCashRequests();
  const metaQuery = useFinanceMeta();
  const createPettyCash = useFinanceMutation(API_ROUTES.FINANCE.PETTY_CASH);
  const approvePettyCash = useFinanceMutation<unknown, { id: string }>(
    (payload) => API_ROUTES.FINANCE.PETTY_CASH_APPROVE(payload.id),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [amountRequested, setAmountRequested] = useState('0');
  const [branchId, setBranchId] = useState('');
  const [requestDate, setRequestDate] = useState(today());
  const [purpose, setPurpose] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createPettyCash.mutateAsync({
        amountRequested: Number(amountRequested),
        branchId: branchId || undefined,
        purpose,
        requestDate,
      });
      setDrawerOpen(false);
      setAmountRequested('0');
      setBranchId('');
      setPurpose('');
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save petty cash request.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Petty cash unavailable" description={query.error?.message ?? 'No petty cash requests returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Petty Cash"
        description="Capture petty cash requests for approval and track disbursement state by branch."
        status="partial"
        actions={
          <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Petty Cash Request
          </Button>
        }
      />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'request_number', header: 'Request #' },
          { key: 'request_date', header: 'Date' },
          { key: 'branch_id', header: 'Branch' },
          { key: 'amount_requested', header: 'Amount', render: (row) => currency.format(Number(row.amount_requested ?? 0)) },
          { key: 'purpose', header: 'Purpose' },
          { key: 'status', header: 'Status' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) =>
              String(row.status ?? '').toUpperCase() === 'PENDING' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={approvePettyCash.isPending}
                  onClick={() => approvePettyCash.mutate({ id: String(row.id) })}
                >
                  Approve
                </Button>
              ) : (
                'No action'
              ),
          },
        ]}
        data={query.data}
      />

      <FormDrawer title="New Petty Cash Request" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Request Date</span>
              <input
                required
                type="date"
                value={requestDate}
                onChange={(event) => setRequestDate(event.target.value)}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Amount Requested</span>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={amountRequested}
                onChange={(event) => setAmountRequested(event.target.value)}
                className="surface-input-soft"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Branch</span>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Head office / no branch</option>
              {(metaQuery.data?.branches ?? []).map((branch) => (
                <option key={String(branch.id)} value={String(branch.id)}>
                  {String(branch.code ?? '')} {String(branch.name ?? '')}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-muted">
            <span>Purpose</span>
            <textarea
              required
              rows={4}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              className="surface-textarea-soft"
              placeholder="What this petty cash is required for"
            />
          </label>

          <div className="surface-tile text-sm text-muted">
            Use journals for direct petty cash account corrections. Use requests when cash must be approved and disbursed.
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPettyCash.isPending}>
              {createPettyCash.isPending ? 'Saving...' : 'Save Request'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
