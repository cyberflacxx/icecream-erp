'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useChartOfAccounts } from '@/hooks/finance/useFinanceResources';

export default function ChartOfAccountsPage() {
  const query = useChartOfAccounts();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Accounts unavailable" description={query.error?.message ?? 'No account data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Chart of Accounts" description="Maintain account codes, classifications, and parent-child structure." status="partial" />
      <FinanceNav />
      <DataTable columns={[{ key: 'account_code', header: 'Code' }, { key: 'account_name', header: 'Account' }, { key: 'account_type', header: 'Type' }, { key: 'parent_account_id', header: 'Parent' }, { key: 'is_active', header: 'Active' }]} data={query.data} />
    </div>
  );
}
