'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBankAccounts } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinanceBankAccountsPage() {
  const query = useBankAccounts();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Bank accounts unavailable" description={query.error?.message ?? 'No bank account data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Bank Accounts" description="View bank accounts, currencies, and current balances." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'bank_name', header: 'Bank' },
          { key: 'account_name', header: 'Account Name' },
          { key: 'account_number', header: 'Account Number' },
          { key: 'branch_name', header: 'Branch' },
          { key: 'currency', header: 'Currency' },
          { key: 'current_balance', header: 'Balance', render: (row) => currency.format(Number(row.current_balance ?? 0)) },
        ]}
        data={query.data}
      />
    </div>
  );
}
