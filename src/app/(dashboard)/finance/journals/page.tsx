'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useFinanceMeta, useFinanceMutation, useJournalEntries } from '@/hooks/finance/useFinanceResources';
import { API_ROUTES } from '@/lib/shared';

interface JournalLine {
  accountId: string;
  creditAmount: string;
  debitAmount: string;
  description: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): JournalLine {
  return {
    accountId: '',
    creditAmount: '0',
    debitAmount: '0',
    description: '',
  };
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function getReferenceHref(row: Record<string, unknown>) {
  const referenceId = String(row.referenceId ?? '');
  const referenceType = String(row.referenceType ?? '').toLowerCase();
  if (!referenceId) return null;
  if (referenceType.includes('invoice')) return `/sales/invoices?invoice=${referenceId}`;
  if (referenceType.includes('payment')) return `/sales/payments?payment=${referenceId}`;
  if (referenceType.includes('supplier')) return `/procurement/payments?payment=${referenceId}`;
  if (referenceType.includes('branch')) return `/finance/transactions?source=${referenceId}`;
  return null;
}

export default function FinanceJournalsPage() {
  const query = useJournalEntries();
  const metaQuery = useFinanceMeta();
  const createJournal = useFinanceMutation(API_ROUTES.FINANCE.JOURNAL_ENTRIES);
  const postJournal = useFinanceMutation<unknown, { id: string }>(
    (payload) => API_ROUTES.FINANCE.JOURNAL_POST(payload.id),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState('');
  const [referenceType, setReferenceType] = useState('MANUAL_ADJUSTMENT');
  const [referenceId, setReferenceId] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debitAmount) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (Number(line.creditAmount) || 0), 0);
    return {
      totalCredit,
      totalDebit,
      variance: totalDebit - totalCredit,
    };
  }, [lines]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLines = lines
      .filter((line) => line.accountId && ((Number(line.debitAmount) || 0) > 0 || (Number(line.creditAmount) || 0) > 0))
      .map((line) => ({
        accountId: line.accountId,
        creditAmount: Number(line.creditAmount) || 0,
        debitAmount: Number(line.debitAmount) || 0,
        description: line.description || undefined,
      }));

    if (normalizedLines.length < 2) {
      setFormError('At least two journal lines are required.');
      return;
    }

    if (Math.abs(totals.variance) > 0.01) {
      setFormError('Debit and credit totals must balance before posting.');
      return;
    }

    try {
      await createJournal.mutateAsync({
        description,
        entryDate,
        lines: normalizedLines,
        referenceId: referenceId || undefined,
        referenceType: referenceType || undefined,
      });
      setDrawerOpen(false);
      setEntryDate(today());
      setDescription('');
      setReferenceType('MANUAL_ADJUSTMENT');
      setReferenceId('');
      setLines([emptyLine(), emptyLine()]);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save journal entry.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Journal entries unavailable" description={query.error?.message ?? 'No journal entry data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Journal Entries"
        description="Capture manual debit and credit adjustments, then post balanced journals into the ledger."
        status="partial"
        actions={
          <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Journal
          </Button>
        }
      />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'entryNumber', header: 'Entry #' },
          { key: 'entryDate', header: 'Date' },
          { key: 'description', header: 'Description' },
          {
            key: 'referenceType',
            header: 'Source',
            render: (row) => {
              const href = getReferenceHref(row);
              const label = String(row.referenceType ?? 'Manual');
              return href ? (
                <Link href={href} className="font-medium text-deepOrange hover:underline">
                  {label}
                </Link>
              ) : (
                label
              );
            },
          },
          { key: 'status', header: 'Status' },
          { key: 'totalDebit', header: 'Debit', render: (row) => currency.format(Number(row.totalDebit ?? 0)) },
          { key: 'totalCredit', header: 'Credit', render: (row) => currency.format(Number(row.totalCredit ?? 0)) },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(row.isPosted) || postJournal.isPending}
                onClick={() => postJournal.mutate({ id: String(row.id) })}
              >
                {row.isPosted ? 'Posted' : 'Post'}
              </Button>
            ),
          },
        ]}
        data={query.data.data}
        pagination={query.data.pagination}
      />

      <FormDrawer title="New Journal Adjustment" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Entry Date</span>
              <input
                required
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Reference Type</span>
              <input
                value={referenceType}
                onChange={(event) => setReferenceType(event.target.value)}
                className="surface-input-soft"
                placeholder="MANUAL_ADJUSTMENT"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Description</span>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="surface-textarea-soft"
              placeholder="Explain the accounting adjustment"
            />
          </label>

          <label className="space-y-2 text-sm text-muted">
            <span>Reference ID / Source Document</span>
            <input
              value={referenceId}
              onChange={(event) => setReferenceId(event.target.value)}
              className="surface-input-soft"
              placeholder="Optional invoice, payment, or document ID"
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-brown">Debit and Credit Lines</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}>
                Add Line
              </Button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-5">
                <select
                  value={line.accountId}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, accountId: event.target.value } : item,
                      ),
                    )
                  }
                  className="surface-input-soft sm:col-span-2"
                >
                  <option value="">Select account</option>
                  {(metaQuery.data?.accounts ?? []).map((account) => (
                    <option key={String(account.id)} value={String(account.id)}>
                      {String(account.account_code ?? '')} - {String(account.account_name ?? '')}
                    </option>
                  ))}
                </select>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={line.debitAmount}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, debitAmount: event.target.value, creditAmount: Number(event.target.value) > 0 ? '0' : item.creditAmount } : item,
                      ),
                    )
                  }
                  className="surface-input-soft"
                  placeholder="Debit"
                />
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={line.creditAmount}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, creditAmount: event.target.value, debitAmount: Number(event.target.value) > 0 ? '0' : item.debitAmount } : item,
                      ),
                    )
                  }
                  className="surface-input-soft"
                  placeholder="Credit"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={lines.length <= 2}
                  onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
                <input
                  value={line.description}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  className="surface-input-soft sm:col-span-5"
                  placeholder="Line narration"
                />
              </div>
            ))}
          </div>

          <div className="surface-tile grid gap-2 text-sm text-muted sm:grid-cols-3">
            <span>Debit: <strong className="text-brown">{currency.format(totals.totalDebit)}</strong></span>
            <span>Credit: <strong className="text-brown">{currency.format(totals.totalCredit)}</strong></span>
            <span>Variance: <strong className={Math.abs(totals.variance) <= 0.01 ? 'text-success' : 'text-error'}>{currency.format(totals.variance)}</strong></span>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createJournal.isPending || metaQuery.isLoading}>
              {createJournal.isPending ? 'Saving...' : 'Save Journal'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
