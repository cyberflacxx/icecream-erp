'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { usePettyCashRequests } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinancePettyCashPage() {
  const query = usePettyCashRequests();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Petty cash unavailable" description={query.error?.message ?? 'No petty cash requests returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Petty Cash" description="Track requests, approvals, and disbursement state for petty cash." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'request_number', header: 'Request #' },
          { key: 'request_date', header: 'Date' },
          { key: 'branch_id', header: 'Branch' },
          { key: 'amount_requested', header: 'Amount', render: (row) => currency.format(Number(row.amount_requested ?? 0)) },
          { key: 'purpose', header: 'Purpose' },
          { key: 'status', header: 'Status' },
        ]}
        data={query.data}
      />
    </div>
  );
}
