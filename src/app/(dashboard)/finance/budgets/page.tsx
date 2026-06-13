'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBudgets } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinanceBudgetsPage() {
  const query = useBudgets();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Budgets unavailable" description={query.error?.message ?? 'No budget data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Budgets" description="Review operating budgets by year, type, branch, and status." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'budget_code', header: 'Budget #' },
          { key: 'name', header: 'Name' },
          { key: 'budget_year', header: 'Year' },
          { key: 'budget_type', header: 'Type' },
          { key: 'branch_id', header: 'Branch' },
          { key: 'status', header: 'Status' },
          { key: 'total_budgeted', header: 'Total', render: (row) => currency.format(Number(row.total_budgeted ?? 0)) },
        ]}
        data={query.data}
      />
    </div>
  );
}
