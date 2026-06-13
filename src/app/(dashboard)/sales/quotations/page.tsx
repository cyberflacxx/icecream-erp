'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesReport } from '@/hooks/sales/useSalesReport';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesQuotationsPage() {
  const query = useSalesReport(API_ROUTES.SALES.QUOTATIONS);
  const rows =
    query.data && typeof query.data === 'object' && Array.isArray((query.data as { data?: unknown }).data)
      ? (query.data as { data: Array<Record<string, unknown>> }).data
      : [];

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Quotations unavailable" description={query.error?.message ?? 'No quotation data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Quotations" description="Track quotation totals, validity dates, and conversion readiness." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'quotationNumber', header: 'Quotation #' },
          { key: 'quotationDate', header: 'Date' },
          { key: 'validUntil', header: 'Valid Until' },
          { key: 'status', header: 'Status' },
          { key: 'itemsCount', header: 'Items' },
          { key: 'total', header: 'Total' },
        ]}
        data={rows}
      />
    </div>
  );
}
