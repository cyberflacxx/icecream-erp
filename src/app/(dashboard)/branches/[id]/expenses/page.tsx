'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useBranchExpenses, useCreateBranchExpense } from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function BranchExpensesPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchExpenses(branchId, { page: 1, pageSize: 50 });
  const createExpense = useCreateBranchExpense(branchId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'BANK' | 'CARD' | 'CASH' | 'ECOCASH' | 'PETTY_CASH'>('CASH');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createExpense.mutateAsync({
        amount: Number(amount),
        category,
        description,
        expenseDate,
        paymentMethod,
      });
      setDrawerOpen(false);
      setCategory('');
      setDescription('');
      setAmount('0');
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save branch expense.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch expenses unavailable" description={query.error?.message ?? 'No expense data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Branch Expenses"
        description="Capture expenses incurred at the branch and review payment method, approval, and posting state."
        actions={
          <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Expense
          </Button>
        }
      />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'expenseDate', header: 'Expense Date' },
          { key: 'category', header: 'Category' },
          { key: 'description', header: 'Description' },
          { key: 'amount', header: 'Amount', render: (row) => currencyFormatter.format(row.amount) },
          { key: 'paymentMethod', header: 'Method' },
          { key: 'status', header: 'Status', render: (row) => row.status ?? 'POSTED' },
        ]}
        data={query.data.data}
        pagination={query.data.pagination}
      />

      <FormDrawer title="Record Branch Expense" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Expense Date</span>
              <input
                required
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Amount</span>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="surface-input-soft"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Category</span>
              <input
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="surface-input-soft"
                placeholder="Rent, fuel, utilities, repairs"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as 'BANK' | 'CARD' | 'CASH' | 'ECOCASH' | 'PETTY_CASH')}
                className="surface-input-soft"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="PETTY_CASH">Petty Cash</option>
                <option value="ECOCASH">EcoCash</option>
                <option value="CARD">Card</option>
              </select>
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
              placeholder="Describe the expense incurred"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Saving...' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
