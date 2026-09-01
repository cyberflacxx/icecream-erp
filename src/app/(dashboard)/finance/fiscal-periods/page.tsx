'use client';

import { AlertCircle, CalendarRange, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DataTable, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useFiscalPeriods, useFinanceMutation } from '@/hooks/finance/useFinanceResources';

type PeriodRow = Record<string, unknown> & {
  end_date?: string;
  id: string;
  is_locked?: boolean;
  period_name?: string;
  start_date?: string;
  status?: string;
};

type FormState = {
  endDate: string;
  periodName: string;
  startDate: string;
  status: 'CLOSED' | 'OPEN';
};

const initialForm: FormState = {
  endDate: '',
  periodName: '',
  startDate: '',
  status: 'OPEN',
};

function toForm(row: PeriodRow): FormState {
  return {
    endDate: String(row.end_date ?? '').slice(0, 10),
    periodName: String(row.period_name ?? ''),
    startDate: String(row.start_date ?? '').slice(0, 10),
    status: String(row.status ?? 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN',
  };
}

export default function FiscalPeriodsPage() {
  const query = useFiscalPeriods();
  const queryClient = useQueryClient();
  const createPeriod = useFinanceMutation('/api/finance/fiscal-periods', { invalidateKey: 'fiscal-periods' });
  const updatePeriod = useFinanceMutation<Record<string, unknown>, FormState & { id: string }>(
    (variables) => `/api/finance/fiscal-periods/${variables.id}`,
    { invalidateKey: 'fiscal-periods', method: 'PATCH' },
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PeriodRow | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ nextStatus: 'CLOSED' | 'OPEN'; row: PeriodRow } | null>(null);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Fiscal periods unavailable"
        description="Fiscal periods could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  const periods = query.data as PeriodRow[];

  function openCreate() {
    setEditing(null);
    setForm(initialForm);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: PeriodRow) {
    setEditing(row);
    setForm(toForm(row));
    setFormError(null);
    setDrawerOpen(true);
  }

  async function savePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!form.periodName.trim() || !form.startDate || !form.endDate) {
      setFormError('Period name, start date, and end date are required.');
      return;
    }
    if (form.endDate < form.startDate) {
      setFormError('End date must be on or after start date.');
      return;
    }

    try {
      if (editing) {
        await updatePeriod.mutateAsync({ ...form, id: editing.id });
      } else {
        await createPeriod.mutateAsync(form);
      }
      setDrawerOpen(false);
      setEditing(null);
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Fiscal period could not be saved.');
    }
  }

  async function confirmStatusChange() {
    if (!confirm) return;
    try {
      await updatePeriod.mutateAsync({
        ...toForm(confirm.row),
        id: confirm.row.id,
        status: confirm.nextStatus,
      });
      setConfirm(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Fiscal period status could not be changed.');
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fiscal Periods"
        description="Manage open and closed accounting periods used by transaction posting validation."
        actions={(
          <Button size="sm" type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Period
          </Button>
        )}
      />
      <FinanceNav />
      {formError ? <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{formError}</div> : null}
      <DataTable
        columns={[
          { key: 'period_name', header: 'Period' },
          { key: 'start_date', header: 'Start' },
          { key: 'end_date', header: 'End' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> },
          { key: 'is_locked', header: 'Locked', render: (row) => (row.is_locked ? 'Yes' : 'No') },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const period = row as PeriodRow;
              const isClosed = String(period.status ?? '').toUpperCase() === 'CLOSED';
              return (
                <div className="flex justify-end gap-2">
                  <Button size="sm" type="button" variant="outline" onClick={() => openEdit(period)}>Edit</Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => setConfirm({ nextStatus: isClosed ? 'OPEN' : 'CLOSED', row: period })}
                  >
                    {isClosed ? 'Reopen' : 'Close'}
                  </Button>
                </div>
              );
            },
          },
        ]}
        data={periods}
        emptyState={(
          <FinanceEmptyState
            icon={<CalendarRange className="h-6 w-6" />}
            title="No fiscal periods found."
            description="Create fiscal periods before posting finance transactions."
            actionLabel="Create Period"
            onAction={openCreate}
          />
        )}
      />

      <FormDrawer title={editing ? 'Edit Fiscal Period' : 'Create Fiscal Period'} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-4" onSubmit={savePeriod}>
          <label className="space-y-2 text-sm text-muted">
            <span>Period Name</span>
            <input className="surface-input-soft" required value={form.periodName} onChange={(event) => setForm((current) => ({ ...current, periodName: event.target.value }))} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Start Date</span>
              <input className="surface-input-soft" required type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>End Date</span>
              <input className="surface-input-soft" required type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Status</span>
            <select className="surface-input-soft" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value === 'CLOSED' ? 'CLOSED' : 'OPEN' }))}>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createPeriod.isPending || updatePeriod.isPending}>
              {editing ? 'Save Changes' : 'Create Period'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        title={confirm?.nextStatus === 'OPEN' ? 'Reopen fiscal period' : 'Close fiscal period'}
        description={
          confirm?.nextStatus === 'OPEN'
            ? `Reopen ${String(confirm?.row.period_name ?? 'this fiscal period')} for transaction posting.`
            : `Close ${String(confirm?.row.period_name ?? 'this fiscal period')} and block new postings inside it.`
        }
        open={Boolean(confirm)}
        loading={updatePeriod.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmStatusChange}
        confirmLabel={confirm?.nextStatus === 'OPEN' ? 'Reopen' : 'Close'}
      />
    </div>
  );
}
