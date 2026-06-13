'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useAccountsReceivable } from '@/hooks/finance/useFinanceResources';

export default function FinanceReceivablesPage() {
  const query = useAccountsReceivable();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Receivables unavailable" description={query.error?.message ?? 'No receivable data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Accounts Receivable" description="Monitor customer balances, due dates, and ageing exposure." status="partial" />
      <FinanceNav />
      <DataTable columns={[{ key: 'invoiceNumber', header: 'Invoice' }, { key: 'customerName', header: 'Customer' }, { key: 'dueDate', header: 'Due Date' }, { key: 'balanceDue', header: 'Balance' }, { key: 'status', header: 'Status' }]} data={query.data} />
    </div>
  );
}
