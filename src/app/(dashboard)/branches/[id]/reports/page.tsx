'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchReport } from '@/hooks/branch-operations';

export default function BranchReportsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchReport('/api/branches/reports/profitability');

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch reports unavailable" description={query.error?.message ?? 'No branch report data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Reports" description="Review branch profitability, reconciliation, variance, and export-ready report output." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'branch_id', header: 'Branch' },
          { key: 'shift_close_id', header: 'Shift' },
          { key: 'sales_total', header: 'Sales' },
          { key: 'expense_total', header: 'Expenses' },
          { key: 'profitability_amount', header: 'Net Profit' },
          { key: 'stock_variance', header: 'Stock Variance' },
          { key: 'cash_variance', header: 'Cash Variance' },
        ]}
        data={query.data}
      />
    </div>
  );
}
