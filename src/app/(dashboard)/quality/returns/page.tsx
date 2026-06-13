'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useQualityReturns } from '@/hooks/quality/useQualityResources';

export default function QualityReturnsPage() {
  const query = useQualityReturns();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Goods returns unavailable" description={query.error?.message ?? 'No goods return data returned.'} />;
  }
  return (
    <div className="space-y-8">
      <PageHeader title="Goods Returns" description="Review Goods Return Vouchers and their QC status before stock movement." status="partial" />
      <QualityNav />
      <DataTable columns={[{ key: 'return_number', header: 'Return #' }, { key: 'return_source', header: 'Source' }, { key: 'return_date', header: 'Date' }, { key: 'status', header: 'Status' }, { key: 'qc_status', header: 'QC Status' }]} data={query.data} />
    </div>
  );
}
