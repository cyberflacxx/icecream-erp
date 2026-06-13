'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useCashAccounts } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinanceCashAccountsPage() {
  const query = useCashAccounts();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Cash accounts unavailable" description={query.error?.message ?? 'No cash account data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Cash Accounts" description="Track cash at hand by account and branch." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'name', header: 'Cash Account' },
          { key: 'branch_id', header: 'Branch' },
          { key: 'balance', header: 'Balance', render: (row) => currency.format(Number(row.balance ?? 0)) },
          { key: 'is_active', header: 'Active', render: (row) => (row.is_active ? 'Yes' : 'No') },
        ]}
        data={query.data}
      />
    </div>
  );
}
