'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesReturns } from '@/hooks/sales/useSalesReturns';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesReturnsPage() {
  const query = useSalesReturns();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Returns unavailable" description={query.error?.message ?? 'No return data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Customer Returns" description="Review return reason, QC status, final stock action, and value." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'return_number', header: 'Return #' },
          { key: 'return_date', header: 'Return Date' },
          { key: 'reason', header: 'Reason' },
          { key: 'qc_status', header: 'QC Status' },
          { key: 'final_stock_action', header: 'Final Action' },
          { key: 'status', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
