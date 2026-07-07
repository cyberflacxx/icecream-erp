'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesReport } from '@/hooks/sales/useSalesReport';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesReportsPage() {
  const query = useSalesReport(API_ROUTES.SALES.REPORT_INVOICE_AGEING);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Reports unavailable" description={query.error?.message ?? 'No report data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sales Reports"
        description="Review sales, ageing, credit, dispatch, returns, and journals from one reporting hub."
        status="partial"
        actions={
          <a href={API_ROUTES.SALES.EXPORT('invoice-ageing')}>
            <Button type="button" size="sm" variant="outline">Export CSV</Button>
          </a>
        }
      />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'customerName', header: 'Customer' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'balanceDue', header: 'Balance Due' },
          { key: 'overdueDays', header: 'Overdue Days' },
          { key: 'paymentStatus', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
