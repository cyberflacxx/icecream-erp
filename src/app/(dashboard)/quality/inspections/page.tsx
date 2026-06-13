'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useQualityInspections } from '@/hooks/quality/useQualityResources';

export default function QualityInspectionsPage() {
  const query = useQualityInspections();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="QC inspections unavailable" description={query.error?.message ?? 'No QC inspection data returned.'} />;
  }
  return (
    <div className="space-y-8">
      <PageHeader title="QC Inspections" description="Track raw material, production, finished goods, and return inspections." status="partial" />
      <QualityNav />
      <DataTable columns={[{ key: 'inspection_number', header: 'Inspection #' }, { key: 'inspection_type', header: 'Type' }, { key: 'reference_document', header: 'Reference' }, { key: 'quantity_inspected', header: 'Inspected' }, { key: 'qc_status', header: 'Status' }, { key: 'inspection_date', header: 'Date' }]} data={query.data} />
    </div>
  );
}
