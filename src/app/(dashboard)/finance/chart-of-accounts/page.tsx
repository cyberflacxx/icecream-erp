'use client';

import { AlertCircle, ScrollText } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, LoadingState } from '@/components/ui-library';
import { useChartOfAccounts } from '@/hooks/finance/useFinanceResources';

export default function ChartOfAccountsPage() {
  const query = useChartOfAccounts();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Accounts unavailable"
        description="Finance accounts could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Chart of Accounts" description="Maintain account codes, classifications, and parent-child structure." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[{ key: 'account_code', header: 'Code' }, { key: 'account_name', header: 'Account' }, { key: 'account_type', header: 'Type' }, { key: 'parent_account_id', header: 'Parent' }, { key: 'is_active', header: 'Active' }]}
        data={query.data}
        emptyState={
          <FinanceEmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No accounts found."
            description="Create chart of account records to start tracking finance transactions."
            actionLabel="Create Account"
            href="/settings/finance-setup"
          />
        }
      />
    </div>
  );
}
