'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
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
  const salesMetaQuery = useSalesMeta();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'BANK' | 'CASH' | 'PETTY_CASH'>('CASH');
  const [cashAccountId, setCashAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const cashAccounts = (salesMetaQuery.data?.cashAccounts ?? []).filter((account) => !account.branchId || account.branchId === branchId);
  const bankAccounts = salesMetaQuery.data?.bankAccounts ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (paymentMethod === 'BANK' && !bankAccountId) {
      setFormError('Select the bank account for this branch expense.');
      return;
    }
    if ((paymentMethod === 'CASH' || paymentMethod === 'PETTY_CASH') && !cashAccountId) {
      setFormError('Select the cash account for this branch expense.');
      return;
    }

    try {
      await createExpense.mutateAsync({
        amount: Number(amount),
        bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
        cashAccountId: paymentMethod === 'BANK' ? null : cashAccountId,
        category,
        description,
        expenseDate,
        paymentMethod,
        referenceNumber: referenceNumber || null,
      });
      setDrawerOpen(false);
      setCategory('');
      setDescription('');
      setAmount('0');
      setReferenceNumber('');
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
                onChange={(event) => setPaymentMethod(event.target.value as 'BANK' | 'CASH' | 'PETTY_CASH')}
                className="surface-input-soft"
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="PETTY_CASH">Petty Cash</option>
              </select>
            </label>
          </div>

          {paymentMethod === 'BANK' ? (
            <label className="space-y-2 text-sm text-muted">
              <span>Bank Account</span>
              <select
                required
                value={bankAccountId}
                onChange={(event) => setBankAccountId(event.target.value)}
                className="surface-input-soft"
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName ? `${account.bankName} - ` : ''}
                    {account.accountName}
                    {account.accountNumber ? ` (${account.accountNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-2 text-sm text-muted">
              <span>{paymentMethod === 'PETTY_CASH' ? 'Petty Cash Account' : 'Cash Account'}</span>
              <select
                required
                value={cashAccountId}
                onChange={(event) => setCashAccountId(event.target.value)}
                className="surface-input-soft"
              >
                <option value="">Select cash account</option>
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {cashAccounts.length === 0 ? (
                <span className="text-xs text-error">No active cash account is configured for this branch.</span>
              ) : null}
            </label>
          )}

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

          <label className="space-y-2 text-sm text-muted">
            <span>Reference</span>
            <input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              className="surface-input-soft"
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
