'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionWastage } from '@/hooks/production/useProductionWastage';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionWastagePage() {
  const query = useProductionWastage();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Wastage unavailable" description={query.error?.message ?? 'No wastage data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Production Wastage" description="Review wastage quantity, reason, type, and cost impact by batch." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'created_at', header: 'Date' },
          { key: 'production_batch_id', header: 'Batch' },
          { key: 'wastage_type', header: 'Type' },
          { key: 'quantity', header: 'Quantity' },
          { key: 'total_cost', header: 'Value' },
          { key: 'reason', header: 'Reason' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
