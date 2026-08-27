'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Banknote, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useCashAccounts, useCashTransactions, useFinanceMeta, useFinanceMutation } from '@/hooks/finance/useFinanceResources';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceCashAccountsPage() {
  const query = useCashAccounts();
  const transactionsQuery = useCashTransactions();
  const metaQuery = useFinanceMeta();
  const createCashAccount = useFinanceMutation('/api/finance/cash-accounts', { invalidateKey: 'cash-accounts' });
  const createTransaction = useFinanceMutation(API_ROUTES.FINANCE.CASH);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newLedgerAccountId, setNewLedgerAccountId] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('USD');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0');
  const [newBranchId, setNewBranchId] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [cashAccountId, setCashAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState(today());
  const [transactionType, setTransactionType] = useState('ADJUSTMENT_IN');
  const [amount, setAmount] = useState('0');
  const [source, setSource] = useState('CASH');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateFormError(null);
    if (!newAccountName.trim() || !newLedgerAccountId || !newCurrencyCode.trim()) {
      setCreateFormError('Cash account name, linked GL account, and currency are required.');
      return;
    }

    try {
      await createCashAccount.mutateAsync({
        accountId: newLedgerAccountId,
        accountName: newAccountName.trim(),
        branchId: newBranchId || null,
        currencyCode: newCurrencyCode.trim().toUpperCase(),
        isActive: newIsActive,
        openingBalance: Number(newOpeningBalance || 0),
      });
      setCreateDrawerOpen(false);
      setNewAccountName('');
      setNewLedgerAccountId('');
      setNewCurrencyCode('USD');
      setNewOpeningBalance('0');
      setNewBranchId('');
      setNewIsActive(true);
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create cash account.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createTransaction.mutateAsync({
        amount: Number(amount),
        cashAccountId,
        counterparty: counterparty || undefined,
        offsetAccountId,
        reference: reference || undefined,
        remarks: remarks || undefined,
        source,
        transactionDate,
        transactionType,
      });
      setDrawerOpen(false);
      setAmount('0');
      setReference('');
      setOffsetAccountId('');
      setCounterparty('');
      setRemarks('');
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save cash transaction.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Cash accounts unavailable"
        description="Cash account data could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cash Accounts"
        description="Track cash at hand, record cash receipts/payments, and post manual cash adjustments."
        status="partial"
        actions={
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setCreateDrawerOpen(true)}>
              + Create Cash Account
            </Button>
            <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Cash Transaction
            </Button>
          </div>
        }
      />
      <FinanceNav />
      <FormDrawer title="Create Cash Account" open={createDrawerOpen} onClose={() => setCreateDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleCreateAccount}>
          {createFormError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {createFormError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Cash Account Name</span>
            <input
              required
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              className="surface-input-soft"
              placeholder="Main Branch Cash"
            />
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Linked GL Account</span>
            <select
              required
              value={newLedgerAccountId}
              onChange={(event) => setNewLedgerAccountId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Select ledger account</option>
              {(metaQuery.data?.accounts ?? []).map((account) => (
                <option key={String(account.id)} value={String(account.id)}>
                  {String(account.code ?? account.account_code ?? '')} - {String(account.name ?? account.account_name ?? '')}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Currency</span>
              <input
                required
                maxLength={3}
                value={newCurrencyCode}
                onChange={(event) => setNewCurrencyCode(event.target.value)}
                className="surface-input-soft uppercase"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Opening Balance</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={newOpeningBalance}
                onChange={(event) => setNewOpeningBalance(event.target.value)}
                className="surface-input-soft"
              />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Branch / Head Office Assignment</span>
            <select
              value={newBranchId}
              onChange={(event) => setNewBranchId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Head Office / Unassigned</option>
              {(metaQuery.data?.branches ?? []).map((branch) => (
                <option key={String(branch.id)} value={String(branch.id)}>
                  {String(branch.name ?? branch.code ?? branch.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={newIsActive}
              onChange={(event) => setNewIsActive(event.target.checked)}
            />
            Active and available in module selectors
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCashAccount.isPending || metaQuery.isLoading}>
              {createCashAccount.isPending ? 'Creating...' : 'Create Cash Account'}
            </Button>
          </div>
        </form>
      </FormDrawer>
      <DataTable
        columns={[
          { key: 'name', header: 'Cash Account' },
          { key: 'branchName', header: 'Branch', render: (row) => String(row.branchName ?? row.branch_id ?? 'Unassigned') },
          { key: 'balance', header: 'Balance', render: (row) => currency.format(Number(row.balance ?? row.currentBalance ?? 0)) },
          { key: 'isActive', header: 'Active', render: (row) => ((row.isActive ?? row.is_active) ? 'Yes' : 'No') },
        ]}
        data={query.data}
        emptyState={
          <FinanceEmptyState
            icon={<Banknote className="h-6 w-6" />}
            title="No cash accounts found."
            description="Create a cash account to track petty cash and cash movements."
            actionLabel="Create Cash Account"
            href="/settings/finance-setup"
          />
        }
      />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-brown">Recent Cash Movements</h2>
        <DataTable
          columns={[
            { key: 'transaction_date', header: 'Date' },
            { key: 'transaction_type', header: 'Type' },
            { key: 'source', header: 'Source' },
            { key: 'reference', header: 'Reference' },
            { key: 'counterparty', header: 'Counterparty' },
            { key: 'amount', header: 'Amount', render: (row) => currency.format(Number(row.amount ?? 0)) },
            { key: 'status', header: 'Status' },
          ]}
          data={transactionsQuery.data ?? []}
          loading={transactionsQuery.isLoading}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No cash movements found"
              description="Cash account adjustments and movements will appear here."
            />
          }
        />
      </div>

      <FormDrawer title="Record Cash Transaction" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <label className="space-y-2 text-sm text-muted">
            <span>Cash Account</span>
            <select
              required
              value={cashAccountId}
              onChange={(event) => setCashAccountId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Select account</option>
              {query.data.map((account) => (
                <option key={String(account.id)} value={String(account.id)}>
                  {String(account.name ?? account.account_name ?? 'Cash account')}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Date</span>
              <input
                required
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Transaction Type</span>
              <select
                value={transactionType}
                onChange={(event) => setTransactionType(event.target.value)}
                className="surface-input-soft"
              >
                <option value="RECEIPT">Receipt</option>
                <option value="PAYMENT">Payment</option>
                <option value="ADJUSTMENT_IN">Adjustment In</option>
                <option value="ADJUSTMENT_OUT">Adjustment Out</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="space-y-2 text-sm text-muted">
              <span>Reference</span>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="surface-input-soft"
                placeholder="Receipt, voucher, or adjustment ref"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Source of Payment</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="surface-input-soft"
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="PETTY_CASH">Petty Cash</option>
              <option value="JOURNAL">Journal Adjustment</option>
              <option value="BRANCH_CASH_UP">Branch Cash-Up</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Offset Ledger Account</span>
            <select
              required
              value={offsetAccountId}
              onChange={(event) => setOffsetAccountId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Select account</option>
              {(metaQuery.data?.accounts ?? []).map((account) => (
                <option key={String(account.id)} value={String(account.id)}>
                  {String(account.code ?? account.account_code ?? '')} - {String(account.name ?? account.account_name ?? '')}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Counterparty</span>
            <input
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              className="surface-input-soft"
              placeholder="Customer, supplier, branch, or staff member"
            />
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Remarks</span>
            <textarea
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="surface-textarea-soft"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? 'Saving...' : 'Save Cash Transaction'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
