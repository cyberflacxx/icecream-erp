'use client';

import { WalletCards } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { useSupplierPayments } from '@/hooks/procurement';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function ProcurementPaymentsPage() {
  const query = useSupplierPayments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Payments"
        description="Review posted supplier payments, linked invoices, methods, and references for accounts payable tracking."
      />
      <ProcurementNav />
      <DataTable
        data={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'paymentDate', header: 'Payment Date' },
          { key: 'supplierName', header: 'Supplier' },
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'amountPaid', header: 'Amount', render: (row) => currencyFormatter.format(row.amountPaid) },
          { key: 'method', header: 'Method' },
          { key: 'reference', header: 'Reference' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        ]}
        emptyState={<EmptyState icon={<WalletCards className="h-6 w-6" />} title="No supplier payments found" description="Payments will appear here after invoices are settled through procurement-finance workflows." />}
      />
    </div>
  );
}
