'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';

import { EmptyState, StatusBadge } from '@/components/ui-library';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import {
  useApproveShiftClose,
  useBranchRealtime,
  useBranchShiftClose,
  useBranchShiftCloses,
  useInitShiftClose,
  useSubmitShiftClose
} from '@/hooks/branch-operations';
import { useUserContext } from '@/contexts/UserContext';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function BranchShiftClosePage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const queryClient = useQueryClient();
  const { currentUser } = useUserContext();
  const [actualCash, setActualCash] = useState('');
  const [actualClosingStock, setActualClosingStock] = useState('');
  const [damagedStockValue, setDamagedStockValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const shiftClosesQuery = useBranchShiftCloses(branchId, {
    endDate: today(),
    page: 1,
    pageSize: 1,
    startDate: today()
  });
  const shiftClose = shiftClosesQuery.data?.data[0] ?? null;
  const shiftCloseDetailQuery = useBranchShiftClose(branchId, shiftClose?.id);
  const shiftCloseDetail = shiftCloseDetailQuery.data;
  const initShiftClose = useInitShiftClose(branchId);
  const submitShiftClose = useSubmitShiftClose(branchId, shiftClose?.id);
  const approveShiftClose = useApproveShiftClose(branchId, shiftClose?.id);
  const canApprove = Boolean(
    currentUser?.roles.some(
      (role) =>
        role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('accountant'),
    ),
  );
  const expectedClosingStock = useMemo(() => {
    if (!shiftCloseDetail) {
      return 0;
    }

    return (
      shiftCloseDetail.openingStockValue +
      shiftCloseDetail.stockReceivedValue -
      shiftCloseDetail.stockSoldValue -
      Number(damagedStockValue || 0)
    );
  }, [damagedStockValue, shiftCloseDetail]);
  const expectedCash = shiftCloseDetail?.expectedCash ?? 0;
  const cashVariance = Number(actualCash || 0) - expectedCash;
  const stockVariance = expectedClosingStock - Number(actualClosingStock || 0);

  useBranchRealtime(branchId, {
    onShiftClose: () => {
      void queryClient.invalidateQueries({
        queryKey: ['branch-operations', 'shift-closes']
      });
      void queryClient.invalidateQueries({
        queryKey: ['branch-operations', 'shift-close']
      });
      void queryClient.invalidateQueries({
        queryKey: ['branch-operations', 'branch-dashboard']
      });
    }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!actualCash || !actualClosingStock) {
      setFormError('Actual cash and actual closing stock are required.');
      return;
    }

    try {
      await submitShiftClose.mutateAsync({
        actualCash: Number(actualCash),
        actualClosingStock: Number(actualClosingStock),
        damagedStockValue: Number(damagedStockValue || 0),
        notes: notes || null
      });
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to submit shift close.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Close"
        description="Finalize branch stock and cash reconciliation before day-end approval."
      />

      <BranchOperationsNav branchId={branchId} />

      {!shiftClose ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="No shift close opened today"
          description="Open today's shift close before submitting branch reconciliation."
          action={
            <Button
              type="button"
              disabled={initShiftClose.isPending}
              onClick={() =>
                initShiftClose.mutate({
                  date: today(),
                  shift: 'DAY'
                })
              }
            >
              {initShiftClose.isPending ? 'Opening...' : 'Open Shift Close'}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Today</p>
              <h2 className="mt-1 text-xl font-semibold text-brown">
                {new Date(shiftClose.shiftDate).toLocaleDateString()} - {shiftClose.shiftType}
              </h2>
            </div>
            <StatusBadge status={shiftClose.status} />
          </div>

          {shiftClose.status === 'OPEN' && shiftCloseDetail ? (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {formError ? (
                <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
                  {formError}
                </div>
              ) : null}

              <section className="rounded-2xl border border-border bg-cream/35 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-brown">Stock Summary</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Opening Stock" value={shiftCloseDetail.openingStockValue} />
                  <Metric label="Stock Received" value={shiftCloseDetail.stockReceivedValue} />
                  <Metric label="Stock Sold" value={shiftCloseDetail.stockSoldValue} />
                  <label className="space-y-1 rounded-2xl bg-white p-3 text-sm text-muted">
                    <span>Damaged Stock Value</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={damagedStockValue}
                      onChange={(event) => setDamagedStockValue(event.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none"
                    />
                  </label>
                  <Metric label="Expected Closing Stock" value={expectedClosingStock} />
                  <label className="space-y-1 rounded-2xl bg-white p-3 text-sm text-muted">
                    <span>Actual Closing Stock</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={actualClosingStock}
                      onChange={(event) => setActualClosingStock(event.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none"
                    />
                  </label>
                  <Metric
                    label="Stock Variance"
                    value={stockVariance}
                    highlight={Math.abs(stockVariance) > 0}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-cream/35 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-brown">Payments</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Cash Sales" value={shiftCloseDetail.expectedCash} />
                  <Metric label="EcoCash Total" value={shiftCloseDetail.ecocashTotal} />
                  <Metric label="Card Total" value={shiftCloseDetail.cardTotal} />
                  <Metric label="Expected Cash" value={expectedCash} />
                  <label className="space-y-1 rounded-2xl bg-white p-3 text-sm text-muted">
                    <span>Actual Cash</span>
                    <input
                      step="0.01"
                      type="number"
                      value={actualCash}
                      onChange={(event) => setActualCash(event.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none"
                    />
                  </label>
                  <Metric label="Cash Variance" value={cashVariance} highlight={Math.abs(cashVariance) > 0} />
                  <Metric label="Expenses Total" value={shiftCloseDetail.expensesTotal} />
                </div>
              </section>

              <label className="space-y-2 text-sm text-muted">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
                />
              </label>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitShiftClose.isPending || !actualCash || !actualClosingStock}>
                  {submitShiftClose.isPending ? 'Submitting...' : 'Submit Shift Close'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 rounded-2xl border border-border bg-cream/35 p-4 text-sm text-muted">
              <p>
                Opening Stock: <strong className="text-brown">{currencyFormatter.format(shiftCloseDetail?.openingStockValue ?? 0)}</strong>
              </p>
              <p>
                Expected Cash: <strong className="text-brown">{currencyFormatter.format(shiftCloseDetail?.expectedCash ?? 0)}</strong>
              </p>
              <p>
                Cash Variance: <strong className="text-brown">{currencyFormatter.format(shiftCloseDetail?.cashVariance ?? 0)}</strong>
              </p>
              <p>
                Stock Variance: <strong className="text-brown">{currencyFormatter.format(shiftCloseDetail?.stockVariance ?? 0)}</strong>
              </p>
              {shiftClose.status === 'SUBMITTED' ? (
                <div className="mt-4 flex items-center justify-between">
                  <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-warning">
                    Awaiting Approval
                  </span>
                  {canApprove ? (
                    <Button
                      size="sm"
                      disabled={approveShiftClose.isPending}
                      onClick={() => approveShiftClose.mutate({})}
                    >
                      {approveShiftClose.isPending ? 'Approving...' : 'Approve'}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? 'rounded-2xl border border-error/30 bg-error/5 p-3 text-sm'
          : 'rounded-2xl bg-white p-3 text-sm'
      }
    >
      <p className="text-muted">{label}</p>
      <p className={highlight ? 'mt-1 font-semibold text-error' : 'mt-1 font-semibold text-brown'}>
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}
