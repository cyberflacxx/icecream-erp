'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useFiscalPeriods } from '@/hooks/finance/useFinanceResources';

export default function FiscalPeriodsPage() {
  const query = useFiscalPeriods();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Fiscal periods unavailable" description={query.error?.message ?? 'No fiscal period data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Fiscal Periods" description="Track open, locked, and historical finance periods for postings and budgets." status="partial" />
      <FinanceNav />
      <DataTable columns={[{ key: 'period_name', header: 'Period' }, { key: 'start_date', header: 'Start' }, { key: 'end_date', header: 'End' }, { key: 'status', header: 'Status' }, { key: 'is_locked', header: 'Locked' }]} data={query.data} />
    </div>
  );
}
