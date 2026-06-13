'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionReport } from '@/hooks/production/useProductionReport';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionReportsPage() {
  const query = useProductionReport(API_ROUTES.PRODUCTION.REPORT_VARIANCE);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Reports unavailable" description={query.error?.message ?? 'No production report data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Production Reports" description="Compare expected and actual output, material usage, and shift efficiency." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'productName', header: 'Product' },
          { key: 'materialVariance', header: 'Material Variance' },
          { key: 'outputVariance', header: 'Output Variance' },
          { key: 'shift', header: 'Shift' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
