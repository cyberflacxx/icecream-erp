'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, Boxes, ClipboardList, Factory, FileSpreadsheet, PackageCheck, ScrollText, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionDashboard } from '@/hooks/production/useProduction';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatCard, StatusBadge } from '@/components/ui-library';

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function ProductionDashboard() {
  const dashboardQuery = useProductionDashboard();

  if (dashboardQuery.isLoading) return <LoadingState />;

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Production data unavailable"
        description={dashboardQuery.error?.message ?? 'No production dashboard data was returned.'}
      />
    );
  }

  const { recentIssues, recentOrders, recentReceipts, stats } = dashboardQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production Dashboard"
        description="Production Orders are the operational source of truth for planning, issue posting, receipt posting, reversals, and close/reopen control."
        actions={(
          <Button asChild size="sm">
            <Link href="/production/orders/new">
              <ClipboardList className="mr-2 h-4 w-4" />
              Planned Production
            </Link>
          </Button>
        )}
      />
      <ProductionNav />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkflowCard
          description="Create a planned production order from the latest active BOM."
          href="/production/orders/new"
          icon={<ClipboardList className="h-5 w-5" />}
          label="Planned Production"
        />
        <WorkflowCard
          description="Open released orders that are ready for material issue posting."
          href="/production/orders?workflow=issue&status=RELEASED"
          icon={<Factory className="h-5 w-5" />}
          label="Issues"
        />
        <WorkflowCard
          description="Open released orders that are ready for finished-goods receipt posting."
          href="/production/orders?workflow=receipt&status=RELEASED"
          icon={<PackageCheck className="h-5 w-5" />}
          label="Receipts"
        />
        <WorkflowCard
          description="Review costing, traceability, and operational reporting."
          href="/production/reports"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="Reports"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Planned Orders" value={formatNumber(stats.plannedOrders)} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Released Orders" value={formatNumber(stats.releasedOrders)} icon={<Factory className="h-5 w-5" />} color="warning" />
        <StatCard title="Closed Orders" value={formatNumber(stats.closedOrders)} icon={<ScrollText className="h-5 w-5" />} color="success" />
        <StatCard title="Orders Requiring Materials" value={formatNumber(stats.ordersRequiringMaterials)} icon={<Boxes className="h-5 w-5" />} color="warning" />
        <StatCard title="Outstanding Material Qty" value={formatNumber(stats.outstandingMaterialQuantity)} icon={<Boxes className="h-5 w-5" />} color="brown" />
        <StatCard title="Outstanding Receipt Qty" value={formatNumber(stats.outstandingFinishedGoodsReceiptQuantity)} icon={<PackageCheck className="h-5 w-5" />} color="brown" />
        <StatCard title="Planned Cost" value={formatMoney(stats.plannedCost)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Actual Cost" value={formatMoney(stats.actualCost)} icon={<TrendingUp className="h-5 w-5" />} color="warning" />
        <StatCard title="Cost Variance" value={formatMoney(stats.costVariance)} icon={<TrendingUp className="h-5 w-5" />} color={stats.costVariance > 0 ? 'warning' : 'success'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <DataTable
          columns={[
            {
              key: 'productionOrderNumber',
              header: 'Order #',
              render: (row) => <Link className="font-semibold text-[color:var(--app-accent-strong)]" href={`/production/orders/${row.id}`}>{row.productionOrderNumber}</Link>,
            },
            { key: 'productNumber', header: 'Product #' },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'releasedQuantity', header: 'Released', render: (row) => formatNumber(Number(row.releasedQuantity ?? 0)) },
            { key: 'remainingQuantity', header: 'Remaining', render: (row) => formatNumber(Number(row.remainingQuantity ?? 0)) },
          ]}
          data={recentOrders}
          emptyState={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No recent production orders" description="Planned, released, and closed production orders will appear here." />}
        />

        <DataTable
          columns={[
            { key: 'documentNumber', header: 'Issue #' },
            { key: 'documentDate', header: 'Date' },
            { key: 'postingStatus', header: 'Status', render: (row) => <StatusBadge status={row.postingStatus} /> },
            { key: 'quantity', header: 'Quantity', render: (row) => formatNumber(Number(row.quantity ?? 0)) },
            { key: 'warehouseName', header: 'Warehouse', render: (row) => String(row.warehouseName ?? '') },
          ]}
          data={recentIssues}
          emptyState={<EmptyState icon={<Factory className="h-6 w-6" />} title="No recent issues" description="Posted production issue documents will appear here." />}
        />

        <DataTable
          columns={[
            { key: 'documentNumber', header: 'Receipt #' },
            { key: 'documentDate', header: 'Date' },
            { key: 'postingStatus', header: 'Status', render: (row) => <StatusBadge status={row.postingStatus} /> },
            { key: 'quantity', header: 'Completed', render: (row) => formatNumber(Number(row.quantity ?? 0)) },
            { key: 'warehouseName', header: 'Warehouse', render: (row) => String(row.warehouseName ?? '') },
          ]}
          data={recentReceipts}
          emptyState={<EmptyState icon={<PackageCheck className="h-6 w-6" />} title="No recent receipts" description="Posted production receipt documents will appear here." />}
        />
      </div>
    </div>
  );
}

function WorkflowCard({ description, href, icon, label }: { description: string; href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="dashboard-blue-card group flex items-start justify-between gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.24)]"
    >
      <div className="flex gap-3">
        <span className="dashboard-blue-icon h-11 w-11">{icon}</span>
        <div>
          <p className="dashboard-blue-value font-semibold">{label}</p>
          <p className="dashboard-blue-copy mt-1 text-sm">{description}</p>
        </div>
      </div>
      <ArrowRight className="dashboard-blue-copy mt-1 h-4 w-4 transition group-hover:translate-x-1 group-hover:text-white" />
    </Link>
  );
}
