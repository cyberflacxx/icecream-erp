'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useFinanceExpenses } from '@/hooks/finance/useFinanceResources';

export default function FinanceExpensesPage() {
  const query = useFinanceExpenses();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Expenses unavailable" description={query.error?.message ?? 'No finance expense data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Expenses" description="Review approved and draft finance expenses across branches and departments." status="partial" />
      <FinanceNav />
      <DataTable columns={[{ key: 'expense_date', header: 'Date' }, { key: 'category', header: 'Category' }, { key: 'description', header: 'Description' }, { key: 'amount', header: 'Amount' }, { key: 'payment_method', header: 'Method' }, { key: 'status', header: 'Status' }]} data={query.data} />
    </div>
  );
}
