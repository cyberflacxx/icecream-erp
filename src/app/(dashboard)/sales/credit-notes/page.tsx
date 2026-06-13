'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesReport } from '@/hooks/sales/useSalesReport';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesCreditNotesPage() {
  const query = useSalesReport(API_ROUTES.SALES.CREDIT_NOTES);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Credit notes unavailable" description={query.error?.message ?? 'No credit note data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Credit Notes" description="Review customer credits raised against approved returns and invoices." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'credit_note_number', header: 'Credit Note #' },
          { key: 'amount', header: 'Amount' },
          { key: 'reason', header: 'Reason' },
          { key: 'status', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
