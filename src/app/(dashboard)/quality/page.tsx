'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, PackageSearch, RotateCcw, Store } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { EmptyState, LoadingState, StatCard } from '@/components/ui-library';
import { useQualityDashboard } from '@/hooks/quality/useQualityResources';

function formatValue(value: unknown) {
  if (typeof value === 'number') return value.toLocaleString();
  return String(value ?? '0');
}

export default function QualityControlPage() {
  const query = useQualityDashboard();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Quality dashboard unavailable" description={query.error?.message ?? 'No quality dashboard data returned.'} />;
  }

  const stats = query.data.stats;

  return (
    <div className="space-y-8">
      <PageHeader title="Quality Control" description="Inspect raw materials, production output, returns, damaged stock, expiry risk, and market findings." status="partial" />
      <QualityNav />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending Inspections" value={formatValue(stats.pendingInspections)} icon={<PackageSearch className="h-5 w-5" />} />
        <StatCard title="Pending Returns" value={formatValue(stats.pendingReturns)} icon={<RotateCcw className="h-5 w-5" />} color="warning" />
        <StatCard title="Failed Inspections" value={formatValue(stats.failedInspections)} icon={<AlertTriangle className="h-5 w-5" />} color="brown" />
        <StatCard title="Reusable Pending" value={formatValue(stats.reusableStockPendingApproval)} icon={<CheckCircle2 className="h-5 w-5" />} color="success" />
        <StatCard title="Damaged Goods Value" value={formatValue(stats.damagedGoodsValue)} icon={<AlertTriangle className="h-5 w-5" />} color="brown" />
        <StatCard title="Expired Goods Value" value={formatValue(stats.expiredGoodsValue)} icon={<AlertTriangle className="h-5 w-5" />} color="warning" />
        <StatCard title="Rework Quantity" value={formatValue(stats.reworkQuantity)} icon={<PackageSearch className="h-5 w-5" />} />
        <StatCard title="Weekly Market Status" value={formatValue(stats.weeklyMarketReportStatus)} icon={<Store className="h-5 w-5" />} />
      </div>
    </div>
  );
}
