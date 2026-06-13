'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchShifts } from '@/hooks/branch-operations';

export default function BranchShiftsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchShifts(branchId);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch shifts unavailable" description={query.error?.message ?? 'No branch shifts returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Shifts" description="Monitor shift state, cash expectations, and variance at branch level." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'shift_date', header: 'Date' },
          { key: 'shift_type', header: 'Shift' },
          { key: 'status', header: 'Status' },
          { key: 'opening_cash', header: 'Opening Cash' },
          { key: 'expected_cash', header: 'Expected Cash' },
          { key: 'actual_cash', header: 'Actual Cash' },
          { key: 'cash_variance', header: 'Cash Variance' },
          { key: 'stock_variance', header: 'Stock Variance' },
        ]}
        data={query.data}
      />
    </div>
  );
}
