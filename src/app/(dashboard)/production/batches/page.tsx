'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useBatches } from '@/hooks/production/useBatches';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionBatchesPage() {
  const query = useBatches();
  const rows =
    query.data && typeof query.data === 'object' && Array.isArray((query.data as { data?: unknown }).data)
      ? (query.data as { data: Array<Record<string, unknown>> }).data
      : [];

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Batches unavailable" description={query.error?.message ?? 'No batch data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Production Batches" description="Review batch execution, expected versus actual output, and quality state." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'productionDate', header: 'Date' },
          { key: 'shift', header: 'Shift' },
          { key: 'status', header: 'Status' },
          { key: 'expectedOutput', header: 'Expected Output' },
          { key: 'actualOutput', header: 'Actual Output' },
        ]}
        data={rows}
      />
    </div>
  );
}
