'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesPayments } from '@/hooks/sales/useSalesPayments';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesPaymentsPage() {
  const query = useSalesPayments();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Payments unavailable" description={query.error?.message ?? 'No payment data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Payments" description="Track customer payments, methods, references, and posted amounts." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'payment_number', header: 'Payment #' },
          { key: 'payment_date', header: 'Payment Date' },
          { key: 'amount', header: 'Amount' },
          { key: 'payment_method', header: 'Method' },
          { key: 'reference_number', header: 'Reference' },
          { key: 'status', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
