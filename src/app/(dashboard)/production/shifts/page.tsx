'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionShiftTargets } from '@/hooks/production/useProductionShiftTargets';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionShiftsPage() {
  const query = useProductionShiftTargets();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Shift targets unavailable" description={query.error?.message ?? 'No shift target data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Shift Management" description="Compare day and night shift targets against planned worker and material usage." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'target_date', header: 'Date' },
          { key: 'shift', header: 'Shift' },
          { key: 'target_output_quantity', header: 'Target Output' },
          { key: 'target_workers', header: 'Target Workers' },
          { key: 'target_material_usage', header: 'Target Material' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
