'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Landmark, Pencil, Plus, Power } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useBankAccounts, useBankTransactions, useFinanceMeta, useFinanceMutation } from '@/hooks/finance/useFinanceResources';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceBankAccountsPage() {
  const query = useBankAccounts();
  const transactionsQuery = useBankTransactions();
  const metaQuery = useFinanceMeta();
  const createBankAccount = useFinanceMutation('/api/finance/bank-accounts', { invalidateKey: 'bank-accounts' });
  const updateBankAccount = useFinanceMutation('/api/finance/bank-accounts', { invalidateKey: 'bank-accounts', method: 'PATCH' });
  const createTransaction = useFinanceMutation(API_ROUTES.FINANCE.BANK_TRANSACTIONS);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Record<string, unknown> | null>(null);
  const [statusTarget, setStatusTarget] = useState<Record<string, unknown> | null>(null);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newLedgerAccountId, setNewLedgerAccountId] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('USD');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0');
  const [newIsActive, setNewIsActive] = useState(true);
  const [bankAccountId, setBankAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState(today());
  const [transactionType, setTransactionType] = useState('DEPOSIT');
  const [amount, setAmount] = useState('0');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [sourceDocument, setSourceDocument] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function openCreateAccountDrawer() {
    setEditingAccount(null);
    setNewBankName('');
    setNewAccountName('');
    setNewAccountNumber('');
    setNewLedgerAccountId('');
    setNewBranchName('');
    setNewCurrencyCode('USD');
    setNewOpeningBalance('0');
    setNewIsActive(true);
    setAccountFormError(null);
    setAccountDrawerOpen(true);
  }

  function openEditAccountDrawer(account: Record<string, unknown>) {
    setEditingAccount(account);
    setNewBankName(String(account.bank_name ?? account.bankName ?? ''));
    setNewAccountName(String(account.account_name ?? account.accountName ?? ''));
    setNewAccountNumber(String(account.account_number ?? account.accountNumber ?? ''));
    setNewLedgerAccountId(String(account.account_id ?? account.accountId ?? ''));
    setNewBranchName(String(account.branch_name ?? account.branchName ?? ''));
    setNewCurrencyCode(String(account.currency_code ?? account.currencyCode ?? account.currency ?? 'USD'));
    setNewOpeningBalance(String(account.opening_balance ?? account.openingBalance ?? account.current_balance ?? account.currentBalance ?? 0));
    setNewIsActive(Boolean(account.is_active ?? account.isActive ?? true));
    setAccountFormError(null);
    setAccountDrawerOpen(true);
  }

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountFormError(null);
    if (!newAccountName.trim() || !newBankName.trim() || (!editingAccount && (!newLedgerAccountId || !newAccountNumber.trim()))) {
      setAccountFormError('Bank name, account name, account number, and linked GL account are required.');
      return;
    }

    try {
      if (editingAccount) {
        await updateBankAccount.mutateAsync({
          id: String(editingAccount.id),
          accountName: newAccountName.trim(),
          branchName: newBranchName.trim(),
          currencyCode: newCurrencyCode.trim().toUpperCase(),
          isActive: newIsActive,
        });
      } else {
        await createBankAccount.mutateAsync({
          accountId: newLedgerAccountId,
          accountName: newAccountName.trim(),
          accountNumber: newAccountNumber.trim(),
          bankName: newBankName.trim(),
          branchName: newBranchName.trim() || undefined,
          currencyCode: newCurrencyCode.trim().toUpperCase(),
          isActive: newIsActive,
          openingBalance: Number(newOpeningBalance || 0),
        });
      }
      setEditingAccount(null);
      setAccountDrawerOpen(false);
    } catch (error) {
      setAccountFormError(error instanceof Error ? error.message : 'Failed to save bank account.');
    }
  }

  async function toggleAccountStatus() {
    if (!statusTarget) return;
    setActionError(null);
    try {
      await updateBankAccount.mutateAsync({
        id: String(statusTarget.id),
        isActive: !Boolean(statusTarget.is_active ?? statusTarget.isActive),
      });
      setStatusTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update bank account status.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createTransaction.mutateAsync({
        amount: Number(amount),
        bankAccountId,
        description: description || undefined,
        offsetAccountId,
        referenceNumber: referenceNumber || undefined,
        sourceDocument: sourceDocument || undefined,
        transactionDate,
        transactionType,
      });
      setDrawerOpen(false);
      setAmount('0');
      setReferenceNumber('');
      setDescription('');
      setSourceDocument('');
      setOffsetAccountId('');
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save bank transaction.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Bank accounts unavailable"
        description="Bank account data could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bank Accounts"
        description="View bank balances and record bank deposits, payments, transfers, and manual adjustments."
        status="partial"
        actions={
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={openCreateAccountDrawer}>
              + Create Bank Account
            </Button>
            <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Bank Transaction
            </Button>
          </div>
        }
      />
      <FinanceNav />
      <FormDrawer
        title={editingAccount ? 'Edit Bank Account' : 'Create Bank Account'}
        open={accountDrawerOpen}
        onClose={() => {
          setAccountDrawerOpen(false);
          setEditingAccount(null);
        }}
      >
        <form className="space-y-5" onSubmit={handleSaveAccount}>
          {accountFormError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {accountFormError}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Bank Name</span>
              <input required value={newBankName} onChange={(event) => setNewBankName(event.target.value)} className="surface-input-soft" disabled={Boolean(editingAccount)} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Account Name</span>
              <input required value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} className="surface-input-soft" />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Account Number</span>
              <input required value={newAccountNumber} onChange={(event) => setNewAccountNumber(event.target.value)} className="surface-input-soft" disabled={Boolean(editingAccount)} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Currency</span>
              <input required maxLength={3} value={newCurrencyCode} onChange={(event) => setNewCurrencyCode(event.target.value)} className="surface-input-soft uppercase" />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Linked GL Account</span>
            <select required value={newLedgerAccountId} onChange={(event) => setNewLedgerAccountId(event.target.value)} className="surface-input-soft" disabled={Boolean(editingAccount)}>
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
              <span>Branch Name</span>
              <input value={newBranchName} onChange={(event) => setNewBranchName(event.target.value)} className="surface-input-soft" />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Opening Balance</span>
              <input min="0" step="0.01" type="number" value={newOpeningBalance} onChange={(event) => setNewOpeningBalance(event.target.value)} className="surface-input-soft" disabled={Boolean(editingAccount)} />
            </label>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm text-muted">
            <input type="checkbox" checked={newIsActive} onChange={(event) => setNewIsActive(event.target.checked)} />
            Active and available in module selectors
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAccountDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBankAccount.isPending || updateBankAccount.isPending || metaQuery.isLoading}>
              {createBankAccount.isPending || updateBankAccount.isPending ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Bank Account'}
            </Button>
          </div>
        </form>
      </FormDrawer>
      <DataTable
        columns={[
          { key: 'bank_name', header: 'Bank' },
          { key: 'account_name', header: 'Account Name', render: (row) => String(row.account_name ?? row.accountName ?? '') },
          { key: 'account_number', header: 'Account Number' },
          { key: 'branch_name', header: 'Branch' },
          { key: 'currency', header: 'Currency' },
          { key: 'current_balance', header: 'Balance', render: (row) => currency.format(Number(row.current_balance ?? row.currentBalance ?? row.balance ?? 0)) },
          { key: 'is_active', header: 'Active', render: (row) => ((row.is_active ?? row.isActive) ? 'Yes' : 'No') },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => openEditAccountDrawer(row)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={(row.is_active ?? row.isActive) ? 'destructive' : 'outline'}
                  onClick={() => {
                    setActionError(null);
                    setStatusTarget(row);
                  }}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {(row.is_active ?? row.isActive) ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ),
          },
        ]}
        data={query.data}
        emptyState={
          <FinanceEmptyState
            icon={<Landmark className="h-6 w-6" />}
            title="No bank accounts found."
            description="Create a bank account to track deposits and payments."
            actionLabel="Create Bank Account"
            href="/settings/finance-setup"
          />
        }
      />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-brown">Recent Bank Movements</h2>
        <DataTable
          columns={[
            { key: 'transactionDate', header: 'Date' },
            { key: 'bankName', header: 'Bank' },
            { key: 'transactionType', header: 'Type' },
            { key: 'referenceNumber', header: 'Reference' },
            { key: 'description', header: 'Description' },
            { key: 'amount', header: 'Amount', render: (row) => currency.format(Number(row.amount ?? 0)) },
            { key: 'status', header: 'Status' },
          ]}
          data={transactionsQuery.data ?? []}
          loading={transactionsQuery.isLoading}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No bank movements found"
              description="Bank deposits, payments, and adjustments will appear here."
            />
          }
        />
      </div>

      <FormDrawer title="Record Bank Transaction" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <label className="space-y-2 text-sm text-muted">
            <span>Bank Account</span>
            <select
              required
              value={bankAccountId}
              onChange={(event) => setBankAccountId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Select bank account</option>
              {query.data.map((account) => (
                <option key={String(account.id)} value={String(account.id)}>
                  {String(account.bank_name ?? '')} - {String(account.account_name ?? account.account_number ?? '')}
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
                <option value="DEPOSIT">Deposit</option>
                <option value="PAYMENT">Payment</option>
                <option value="WITHDRAWAL">Withdrawal</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
                <option value="ADJUSTMENT_IN">Adjustment In</option>
                <option value="ADJUSTMENT_OUT">Adjustment Out</option>
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
              <span>Reference Number</span>
              <input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                className="surface-input-soft"
                placeholder="Bank ref, cheque, transfer ID"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Source of Payment</span>
            <select
              value={sourceDocument}
              onChange={(event) => setSourceDocument(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Select source</option>
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
              <option value="PETTY_CASH">Petty Cash</option>
              <option value="JOURNAL">Journal Adjustment</option>
              <option value="INVOICE">Invoice</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="surface-textarea-soft"
            />
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

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? 'Saving...' : 'Save Bank Transaction'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={(statusTarget?.is_active ?? statusTarget?.isActive) ? 'Deactivate bank account' : 'Activate bank account'}
        description={
          (statusTarget?.is_active ?? statusTarget?.isActive)
            ? 'This preserves bank history and removes the account from active selectors.'
            : 'This makes the bank account available in selectors again.'
        }
        confirmLabel={(statusTarget?.is_active ?? statusTarget?.isActive) ? 'Deactivate' : 'Activate'}
        loading={updateBankAccount.isPending}
        errorMessage={actionError}
        onCancel={() => {
          setStatusTarget(null);
          setActionError(null);
        }}
        onConfirm={() => void toggleAccountStatus()}
      />
    </div>
  );
}
