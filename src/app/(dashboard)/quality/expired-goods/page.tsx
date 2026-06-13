'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useExpiredGoods } from '@/hooks/quality/useQualityResources';

export default function ExpiredGoodsPage() {
  const query = useExpiredGoods();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Expired goods unavailable" description={query.error?.message ?? 'No expired goods data returned.'} />;
  }
  return (
    <div className="space-y-8">
      <PageHeader title="Expired Goods" description="Review expired stock, value impact, and blocked return-to-stock items." status="partial" />
      <QualityNav />
      <DataTable columns={[{ key: 'item_id', header: 'Item' }, { key: 'batch_number', header: 'Batch' }, { key: 'expiry_date', header: 'Expiry' }, { key: 'quantity_expired', header: 'Quantity' }, { key: 'total_value', header: 'Value' }, { key: 'status', header: 'Status' }]} data={query.data} />
    </div>
  );
}
