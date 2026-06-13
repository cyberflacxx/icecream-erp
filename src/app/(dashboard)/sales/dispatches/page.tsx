'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesReport } from '@/hooks/sales/useSalesReport';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesDispatchesPage() {
  const query = useSalesReport(API_ROUTES.SALES.DISPATCHES);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Dispatches unavailable" description={query.error?.message ?? 'No dispatch data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Dispatch Management" description="Manage dispatch notes, invoice linkage, and dispatch status." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'dispatch_note_number', header: 'Dispatch Note' },
          { key: 'invoice_id', header: 'Invoice' },
          { key: 'warehouse_id', header: 'Warehouse' },
          { key: 'dispatch_date', header: 'Dispatch Date' },
          { key: 'status', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
