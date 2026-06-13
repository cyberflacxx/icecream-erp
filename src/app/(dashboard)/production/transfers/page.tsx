'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionReport } from '@/hooks/production/useProductionReport';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionTransfersPage() {
  const query = useProductionReport(API_ROUTES.PRODUCTION.REPORT_PERFORMANCE);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Transfer readiness unavailable" description={query.error?.message ?? 'No transfer-oriented production data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Finished Goods Transfers" description="Use completed batch output and efficiency data to stage store transfers." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'shift', header: 'Shift' },
          { key: 'actualOutput', header: 'Accepted Output' },
          { key: 'yieldPercentage', header: 'Yield %' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
