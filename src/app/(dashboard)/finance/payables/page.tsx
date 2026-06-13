'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useAccountsPayable } from '@/hooks/finance/useFinanceResources';

export default function FinancePayablesPage() {
  const query = useAccountsPayable();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Payables unavailable" description={query.error?.message ?? 'No payable data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Accounts Payable" description="Track supplier invoice balances, due dates, and payment exposure." status="partial" />
      <FinanceNav />
      <DataTable columns={[{ key: 'invoiceNumber', header: 'Invoice' }, { key: 'supplierName', header: 'Supplier' }, { key: 'dueDate', header: 'Due Date' }, { key: 'balance', header: 'Balance' }, { key: 'status', header: 'Status' }]} data={query.data} />
    </div>
  );
}
