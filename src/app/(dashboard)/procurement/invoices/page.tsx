'use client';

import { ReceiptText } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { useSupplierInvoices } from '@/hooks/procurement';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function ProcurementInvoicesPage() {
  const query = useSupplierInvoices();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Invoices"
        description="Track invoice totals, balances, purchase order references, and payment exposure for suppliers."
      />
      <ProcurementNav />
      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'supplierName', header: 'Supplier' },
          { key: 'purchaseOrderNumber', header: 'PO #' },
          { key: 'invoiceDate', header: 'Invoice Date' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'total', header: 'Total', render: (row) => currencyFormatter.format(row.total) },
          { key: 'paidAmount', header: 'Paid', render: (row) => currencyFormatter.format(row.paidAmount) },
          { key: 'balance', header: 'Balance', render: (row) => currencyFormatter.format(row.balance) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        ]}
        emptyState={<EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No supplier invoices found" description="Supplier invoices will appear here once recorded against purchase orders or GRNs." />}
      />
    </div>
  );
}
