'use client';

import { AlertCircle, CalendarRange } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, LoadingState } from '@/components/ui-library';
import { useFiscalPeriods } from '@/hooks/finance/useFinanceResources';

export default function FiscalPeriodsPage() {
  const query = useFiscalPeriods();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Fiscal periods unavailable"
        description="Fiscal periods could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Fiscal Periods" description="Track open, locked, and historical finance periods for postings and budgets." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[{ key: 'period_name', header: 'Period' }, { key: 'start_date', header: 'Start' }, { key: 'end_date', header: 'End' }, { key: 'status', header: 'Status' }, { key: 'is_locked', header: 'Locked' }]}
        data={query.data}
        emptyState={
          <FinanceEmptyState
            icon={<CalendarRange className="h-6 w-6" />}
            title="No fiscal periods found."
            description="Create fiscal periods before posting finance transactions."
            actionLabel="Create Period"
            href="/settings/finance-setup"
          />
        }
      />
    </div>
  );
}
