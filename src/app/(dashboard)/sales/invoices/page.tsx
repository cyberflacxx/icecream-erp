'use client';

import { AlertCircle, ReceiptText, WalletCards } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { DataTable, EmptyState, LoadingState, StatCard } from '@/components/ui-library';
import { type InvoiceListItem, useInvoices } from '@/hooks/sales/useInvoices';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export default function InvoicesPage() {
  const query = useInvoices();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Invoices unavailable" description={query.error?.message ?? 'No invoice data returned.'} />;
  }

  const rows = query.data.data;
  const outstanding = rows.reduce((sum, row) => sum + row.balanceDue, 0);
  const overdue = rows
    .filter((row) => row.balanceDue > 0 && row.dueDate && new Date(row.dueDate).getTime() < Date.now())
    .reduce((sum, row) => sum + row.balanceDue, 0);
  const collected = rows.reduce((sum, row) => sum + row.amountPaid, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Invoices" description="Track billing, collections, due dates, and invoice settlement status." status="partial" />
      <SalesNav />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatCard title="Outstanding" value={currency.format(outstanding)} icon={<WalletCards className="h-5 w-5" />} />
        <StatCard title="Overdue" value={currency.format(overdue)} icon={<AlertCircle className="h-5 w-5" />} color="warning" />
        <StatCard title="Collected" value={currency.format(collected)} icon={<ReceiptText className="h-5 w-5" />} color="success" />
      </div>
      <DataTable
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'invoiceDate', header: 'Invoice Date' },
          {
            key: 'customer',
            header: 'Customer',
            render: (row) => row.customer?.name ?? 'Unassigned',
          },
          { key: 'itemsCount', header: 'Items' },
          { key: 'total', header: 'Total', render: (row) => currency.format(row.total), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'amountPaid', header: 'Paid', render: (row) => currency.format(row.amountPaid), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'balanceDue', header: 'Balance', render: (row) => currency.format(row.balanceDue), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'dueDate', header: 'Due Date', render: (row) => row.dueDate ?? 'Not set' },
          { key: 'status', header: 'Status' },
        ]}
        data={rows}
        pagination={query.data.pagination}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No invoices found" description="Approved orders and direct invoices will appear here." />}
      />
    </div>
  );
}
