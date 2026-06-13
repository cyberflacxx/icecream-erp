'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchReturns } from '@/hooks/branch-operations';

export default function BranchReturnsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchReturns(branchId);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch returns unavailable" description={query.error?.message ?? 'No branch returns returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Returns" description="Monitor returns, QC status, and final stock action per branch." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'return_number', header: 'Return #' },
          { key: 'quantity_returned', header: 'Quantity' },
          { key: 'return_reason', header: 'Reason' },
          { key: 'qc_status', header: 'QC Status' },
          { key: 'final_action', header: 'Final Action', render: (row) => row.final_action ?? 'Pending' },
          { key: 'status', header: 'Status' },
        ]}
        data={query.data}
      />
    </div>
  );
}
