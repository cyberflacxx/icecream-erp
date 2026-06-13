'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionPlans } from '@/hooks/production/useProductionPlans';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionPlansPage() {
  const query = useProductionPlans();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Plans unavailable" description={query.error?.message ?? 'No plan data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Production Planning" description="Review plan numbers, target shifts, recipe mix, and execution status." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'plan_number', header: 'Plan #' },
          { key: 'plan_date', header: 'Date' },
          { key: 'shift', header: 'Shift' },
          { key: 'production_line', header: 'Line' },
          { key: 'status', header: 'Status' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
