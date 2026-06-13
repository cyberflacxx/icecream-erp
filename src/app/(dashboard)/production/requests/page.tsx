'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionMaterialRequests } from '@/hooks/production/useProductionMaterialRequests';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function ProductionRequestsPage() {
  const query = useProductionMaterialRequests();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Requests unavailable" description={query.error?.message ?? 'No material request data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Material Requests" description="Monitor requested, approved, and issued raw materials from stores into production." status="partial" />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'request_number', header: 'Request #' },
          { key: 'request_date', header: 'Date' },
          { key: 'status', header: 'Status' },
          { key: 'production_batch_id', header: 'Batch' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
