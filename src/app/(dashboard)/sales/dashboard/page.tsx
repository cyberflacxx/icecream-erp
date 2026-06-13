'use client';

import { AlertCircle, ReceiptText, ShieldAlert, Truck, WalletCards, Warehouse } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesDashboard } from '@/hooks/sales/useSalesDashboard';
import { EmptyState, LoadingState, StatCard } from '@/components/ui-library';

export default function SalesDashboardPage() {
  const query = useSalesDashboard();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Sales dashboard unavailable" description={query.error?.message ?? 'No sales dashboard data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Sales Dashboard" description="Monitor invoices, dispatch, credit exposure, and stock available for sale." status="partial" />
      <SalesNav />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Today Sales" value={query.data.stats.todaySales} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard title="Pending Dispatch" value={query.data.stats.pendingDispatches} icon={<Truck className="h-5 w-5" />} color="warning" />
        <StatCard title="Overdue Invoices" value={query.data.stats.overdueInvoices} icon={<WalletCards className="h-5 w-5" />} color="warning" />
        <StatCard title="Credit Alerts" value={query.data.stats.creditAlerts} icon={<ShieldAlert className="h-5 w-5" />} color="warning" />
        <StatCard title="Saleable Stock" value={query.data.stats.stockAvailableForSale} icon={<Warehouse className="h-5 w-5" />} color="success" />
      </div>
    </div>
  );
}
