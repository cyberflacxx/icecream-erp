'use client';

import { AlertCircle, FileBarChart2, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { FormDrawer, LoadingState } from '@/components/ui-library';
import { useFinanceExpenses, useFinanceMeta, useFinanceMutation } from '@/hooks/finance/useFinanceResources';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency',
});

type ExpenseFormState = {
  accountId: string;
  amount: string;
  bankAccountId: string;
  branchId: string;
  cashAccountId: string;
  category: string;
  description: string;
  expenseDate: string;
  paymentMethod: 'BANK' | 'CASH' | 'PETTY_CASH';
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function createInitialFormState(): ExpenseFormState {
  return {
    accountId: '',
    amount: '',
    bankAccountId: '',
    branchId: '',
    cashAccountId: '',
    category: '',
    description: '',
    expenseDate: todayIsoDate(),
    paymentMethod: 'CASH',
  };
}

function text(row: Record<string, unknown>, key: string, fallback = '') {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
}

export default function FinanceExpensesPage() {
  const query = useFinanceExpenses();
  const metaQuery = useFinanceMeta();
  const createExpense = useFinanceMutation('/api/finance/expenses', { invalidateKey: 'expenses' });
  const postExpense = useFinanceMutation(
    (variables: { id: string }) => `/api/finance/expenses/${variables.id}/post`,
    { invalidateKey: 'expenses' },
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Expenses unavailable"
        description="Expense data could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  const accounts = metaQuery.data?.accounts ?? [];
  const expenseAccounts = accounts.filter((account) => {
    const type = String(account.type ?? account.accountType ?? account.category ?? '').toUpperCase();
    return type.includes('EXPENSE') || type.includes('COGS') || type.includes('COST');
  });
  const accountOptions = expenseAccounts.length > 0 ? expenseAccounts : accounts;
  const paymentRequiresCash = form.paymentMethod === 'CASH' || form.paymentMethod === 'PETTY_CASH';

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!form.accountId || !form.category.trim() || !form.description.trim() || Number(form.amount) <= 0) {
      setFormError('Expense account, category, description, and a positive amount are required.');
      return;
    }
    if (paymentRequiresCash && !form.cashAccountId) {
      setFormError('Select the cash account that pays this expense.');
      return;
    }
    if (form.paymentMethod === 'BANK' && !form.bankAccountId) {
      setFormError('Select the bank account that pays this expense.');
      return;
    }

    try {
      await createExpense.mutateAsync({
        accountId: form.accountId,
        amount: Number(form.amount),
        bankAccountId: form.paymentMethod === 'BANK' ? form.bankAccountId : undefined,
        branchId: form.branchId || undefined,
        cashAccountId: paymentRequiresCash ? form.cashAccountId : undefined,
        category: form.category.trim(),
        description: form.description.trim(),
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
      });
      setForm(createInitialFormState());
      setIsDrawerOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create expense.');
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expenses"
        description="Review, create, and post finance expenses with linked cash or bank accounts."
        status="partial"
        actions={(
          <Button type="button" onClick={() => setIsDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Expense
          </Button>
        )}
      />
      <FinanceNav />
      {query.data.length === 0 ? (
        <FinanceEmptyState
          icon={<FileBarChart2 className="h-6 w-6" />}
          title="No expenses found."
          description="Record expenses or approve petty cash requests to populate this section."
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-cream/70 text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => {
                const id = text(row, 'id');
                const status = text(row, 'status', 'DRAFT').toUpperCase();
                return (
                  <tr key={id} className="border-t border-border/60">
                    <td className="px-4 py-3">{text(row, 'expense_date')}</td>
                    <td className="px-4 py-3">{text(row, 'category')}</td>
                    <td className="px-4 py-3">{text(row, 'description')}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(Number(row.amount ?? 0))}</td>
                    <td className="px-4 py-3">{text(row, 'payment_method')}</td>
                    <td className="px-4 py-3">{status}</td>
                    <td className="px-4 py-3">
                      {status === 'POSTED' ? (
                        <span className="text-xs text-muted">Posted</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={postExpense.isPending}
                          onClick={() => void postExpense.mutateAsync({ id })}
                        >
                          Post
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormDrawer
        title="Record Expense"
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setFormError(null);
        }}
      >
        <p className="text-sm text-muted">Create a draft expense and select the cash or bank account that will fund it.</p>
        <form className="space-y-4" onSubmit={submitExpense}>
          {formError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div> : null}
          <input
            type="date"
            className="surface-input-soft"
            value={form.expenseDate}
            onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))}
          />
          <input
            className="surface-input-soft"
            placeholder="Category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          />
          <textarea
            className="surface-input-soft min-h-24"
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
          <input
            className="surface-input-soft"
            min="0.01"
            step="0.01"
            type="number"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          />
          <select
            className="surface-input-soft"
            value={form.accountId}
            onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
          >
            <option value="">Expense account</option>
            {accountOptions.map((account) => (
              <option key={String(account.id)} value={String(account.id)}>
                {String(account.code ?? account.accountCode ?? '')} {String(account.name ?? account.accountName ?? '')}
              </option>
            ))}
          </select>
          <select
            className="surface-input-soft"
            value={form.branchId}
            onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
          >
            <option value="">No branch / head office</option>
            {(metaQuery.data?.branches ?? []).map((branch) => (
              <option key={String(branch.id)} value={String(branch.id)}>
                {String(branch.name ?? branch.code ?? branch.id)}
              </option>
            ))}
          </select>
          <select
            className="surface-input-soft"
            value={form.paymentMethod}
            onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as ExpenseFormState['paymentMethod'] }))}
          >
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="PETTY_CASH">Petty Cash</option>
          </select>
          {paymentRequiresCash ? (
            <select
              className="surface-input-soft"
              value={form.cashAccountId}
              onChange={(event) => setForm((current) => ({ ...current, cashAccountId: event.target.value }))}
            >
              <option value="">Cash account</option>
              {(metaQuery.data?.cashAccounts ?? []).map((account) => (
                <option key={String(account.id)} value={String(account.id)}>
                  {String(account.name ?? account.accountName ?? account.account_name ?? account.id)}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="surface-input-soft"
              value={form.bankAccountId}
              onChange={(event) => setForm((current) => ({ ...current, bankAccountId: event.target.value }))}
            >
              <option value="">Bank account</option>
              {(metaQuery.data?.bankAccounts ?? []).map((account) => (
                <option key={String(account.id)} value={String(account.id)}>
                  {String(account.accountName ?? account.account_name ?? account.bankName ?? account.bank_name ?? account.id)}
                </option>
              ))}
            </select>
          )}
          <Button type="submit" disabled={createExpense.isPending || metaQuery.isLoading}>
            Save Draft Expense
          </Button>
        </form>
      </FormDrawer>
    </div>
  );
}
