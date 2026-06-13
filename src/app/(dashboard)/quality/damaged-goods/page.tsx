'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useDamagedGoods } from '@/hooks/quality/useQualityResources';

export default function DamagedGoodsPage() {
  const query = useDamagedGoods();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Damaged goods unavailable" description={query.error?.message ?? 'No damaged goods data returned.'} />;
  }
  return (
    <div className="space-y-8">
      <PageHeader title="Damaged Goods" description="Track damaged stock, value impact, and approval status." status="partial" />
      <QualityNav />
      <DataTable columns={[{ key: 'item_id', header: 'Item' }, { key: 'quantity', header: 'Quantity' }, { key: 'total_value', header: 'Value' }, { key: 'damage_reason', header: 'Reason' }, { key: 'status', header: 'Status' }]} data={query.data} />
    </div>
  );
}
