'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchCustomers } from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BranchCustomersPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchCustomers(branchId);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch customers unavailable" description={query.error?.message ?? 'No branch customers returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Customers" description="Manage branch-level walk-in and credit customer accounts." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'customer_code', header: 'Customer #' },
          { key: 'customer_name', header: 'Customer' },
          { key: 'phone_number', header: 'Phone' },
          { key: 'customer_type', header: 'Type' },
          { key: 'credit_allowed', header: 'Credit', render: (row) => (row.credit_allowed ? 'Allowed' : 'Cash Only') },
          { key: 'credit_limit', header: 'Credit Limit', render: (row) => currencyFormatter.format(Number(row.credit_limit ?? 0)) },
          { key: 'current_balance', header: 'Balance', render: (row) => currencyFormatter.format(Number(row.current_balance ?? 0)) },
        ]}
        data={query.data}
      />
    </div>
  );
}
