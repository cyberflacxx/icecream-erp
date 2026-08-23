'use client';

import { type FormEvent, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Landmark, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
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
  const createTransaction = useFinanceMutation(API_ROUTES.FINANCE.BANK_TRANSACTIONS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState(today());
  const [transactionType, setTransactionType] = useState('DEPOSIT');
  const [amount, setAmount] = useState('0');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [sourceDocument, setSourceDocument] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
            <Button asChild type="button" size="sm" variant="outline">
              <Link href="/settings/finance-setup">+ Create Bank Account</Link>
            </Button>
            <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Bank Transaction
            </Button>
          </div>
        }
      />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'bank_name', header: 'Bank' },
          { key: 'account_name', header: 'Account Name', render: (row) => String(row.account_name ?? row.accountName ?? '') },
          { key: 'account_number', header: 'Account Number' },
          { key: 'branch_name', header: 'Branch' },
          { key: 'currency', header: 'Currency' },
          { key: 'current_balance', header: 'Balance', render: (row) => currency.format(Number(row.current_balance ?? row.currentBalance ?? row.balance ?? 0)) },
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
    </div>
  );
}
