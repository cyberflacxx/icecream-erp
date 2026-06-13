'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { type SalesOrderListItem, useSalesOrders } from '@/hooks/sales/useSalesOrders';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export default function SalesOrdersPage() {
  const query = useSalesOrders();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Sales orders unavailable" description={query.error?.message ?? 'No sales orders returned.'} />;
  }

  const rows = query.data.data;

  return (
    <div className="space-y-8">
      <PageHeader title="Sales Orders" description="Track order intake, approvals, required dates, and commercial value." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'orderNumber', header: 'Order #' },
          { key: 'orderDate', header: 'Order Date' },
          {
            key: 'customer',
            header: 'Customer',
            render: (row) => row.customer?.name ?? 'Unassigned',
          },
          { key: 'requiredDate', header: 'Required Date', render: (row) => row.requiredDate ?? 'Not set' },
          { key: 'itemsCount', header: 'Items' },
          { key: 'total', header: 'Total', render: (row) => currency.format(row.total), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'status', header: 'Status' },
        ]}
        data={rows}
        pagination={query.data.pagination}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No sales orders found" description="Approved quotations and new customer demand will appear here." />}
      />
    </div>
  );
}
