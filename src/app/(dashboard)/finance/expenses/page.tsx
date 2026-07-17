'use client';

import { AlertCircle, FileBarChart2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, LoadingState } from '@/components/ui-library';
import { useFinanceExpenses } from '@/hooks/finance/useFinanceResources';

export default function FinanceExpensesPage() {
  const query = useFinanceExpenses();
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

  return (
    <div className="space-y-8">
      <PageHeader title="Expenses" description="Review approved and draft finance expenses across branches and departments." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[{ key: 'expense_date', header: 'Date' }, { key: 'category', header: 'Category' }, { key: 'description', header: 'Description' }, { key: 'amount', header: 'Amount' }, { key: 'payment_method', header: 'Method' }, { key: 'status', header: 'Status' }]}
        data={query.data}
        emptyState={
          <FinanceEmptyState
            icon={<FileBarChart2 className="h-6 w-6" />}
            title="No expenses found."
            description="Record expenses or approve petty cash requests to populate this section."
          />
        }
      />
    </div>
  );
}
