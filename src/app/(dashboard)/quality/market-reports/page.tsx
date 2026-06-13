'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useMarketReports } from '@/hooks/quality/useQualityResources';

export default function MarketReportsPage() {
  const query = useMarketReports();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Market reports unavailable" description={query.error?.message ?? 'No market report data returned.'} />;
  }
  return (
    <div className="space-y-8">
      <PageHeader title="Market Reports" description="Track weekly market visits, quality findings, and recommended actions." status="partial" />
      <QualityNav />
      <DataTable columns={[{ key: 'report_number', header: 'Report #' }, { key: 'market_location', header: 'Market' }, { key: 'visit_date', header: 'Visit Date' }, { key: 'quality_issue_found', header: 'Issue' }, { key: 'recommended_action', header: 'Action' }, { key: 'status', header: 'Status' }]} data={query.data} />
    </div>
  );
}
