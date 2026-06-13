'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchPayments } from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BranchPaymentsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchPayments(branchId);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch payments unavailable" description={query.error?.message ?? 'No branch payments returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Payments" description="Track shift payments, customer settlements, and references." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'payment_date', header: 'Payment Date' },
          { key: 'payment_method', header: 'Method' },
          { key: 'amount_paid', header: 'Amount', render: (row) => currencyFormatter.format(Number(row.amount_paid ?? 0)) },
          { key: 'reference_number', header: 'Reference' },
          { key: 'status', header: 'Status' },
        ]}
        data={query.data}
      />
    </div>
  );
}
