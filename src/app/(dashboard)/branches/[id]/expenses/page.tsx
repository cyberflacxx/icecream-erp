'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchExpenses } from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BranchExpensesPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchExpenses(branchId, { page: 1, pageSize: 50 });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch expenses unavailable" description={query.error?.message ?? 'No expense data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Expenses" description="Review branch operating expenses, payment methods, and approval state." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'expenseDate', header: 'Expense Date' },
          { key: 'category', header: 'Category' },
          { key: 'description', header: 'Description' },
          { key: 'amount', header: 'Amount', render: (row) => currencyFormatter.format(row.amount) },
          { key: 'paymentMethod', header: 'Method' },
          { key: 'status', header: 'Status', render: (row) => row.status ?? 'POSTED' },
        ]}
        data={query.data.data}
        pagination={query.data.pagination}
      />
    </div>
  );
}
