'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, Factory, FileSpreadsheet, Gauge, PackageOpen, Scale, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { useProductionDashboard } from '@/hooks/production/useProduction';
import { ChartCard, DataTable, EmptyState, LoadingState, StatCard } from '@/components/ui-library';

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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

  const { stats, charts, openBatches, materialsAtRisk, qualityAlerts } = dashboardQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production Module"
        description="Simple SAP-style manufacturing: BOM standard, issue raw materials, release finished goods."
      />
      <ProductionNav />

      <section className="grid gap-4 md:grid-cols-3">
        <WorkflowCard
          description="Create the standard recipe for one finished product."
          href="/production/recipes"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="1. BOM"
        />
        <WorkflowCard
          description="Enter production quantity and auto-deduct raw materials."
          href="/production/batches"
          icon={<Scale className="h-5 w-5" />}
          label="2. Issue"
        />
        <WorkflowCard
          description="Post actual output into the production warehouse."
          href="/production/batches"
          icon={<PackageOpen className="h-5 w-5" />}
          label="3. Release"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Planned Batches" value={formatNumber(stats.plannedBatches)} icon={<PackageOpen className="h-5 w-5" />} />
        <StatCard title="In Progress" value={formatNumber(stats.inProgressBatches)} icon={<Factory className="h-5 w-5" />} color="warning" />
        <StatCard title="Completed Today" value={formatNumber(stats.completedToday)} icon={<ShieldAlert className="h-5 w-5" />} color="success" />
        <StatCard title="Avg Efficiency" value={`${formatNumber(stats.avgEfficiency)}%`} icon={<Gauge className="h-5 w-5" />} color="brown" />
        <StatCard title="Total Wastage" value={formatNumber(stats.totalWastage)} icon={<TriangleAlert className="h-5 w-5" />} color="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Output Last 7 Days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={charts.outputLast7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3D7B6" />
                <XAxis dataKey="day" stroke="#6B4A3A" fontSize={12} />
                <YAxis stroke="#6B4A3A" fontSize={12} />
                <Tooltip />
                <Bar dataKey="output" fill="#F97316" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Batch Status Breakdown">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <PieChart>
                <Tooltip />
                <Pie data={charts.statusBreakdown} dataKey="count" nameKey="status" outerRadius={105} fill="#3B1F12" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          columns={[
            { key: 'batchNumber', header: 'Batch #' },
            { key: 'productionDate', header: 'Date' },
            { key: 'shift', header: 'Shift' },
            { key: 'productionLine', header: 'Line' },
            { key: 'status', header: 'Status' },
            { key: 'output', header: 'Output' },
          ]}
          data={openBatches}
          emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No open batches" description="All batches are currently closed or completed." />}
        />

        <DataTable
          columns={[
            { key: 'item', header: 'Raw Material' },
            { key: 'warehouse', header: 'Warehouse' },
            { key: 'available', header: 'Available' },
            { key: 'reorderLevel', header: 'Reorder Level' },
            { key: 'deficit', header: 'Deficit' },
          ]}
          data={materialsAtRisk}
          emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No material risk" description="No raw materials are currently below reorder level." />}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard title="Quality Pending" value={formatNumber(qualityAlerts.pending)} icon={<ShieldAlert className="h-5 w-5" />} color="brown" />
        <StatCard title="Quality Failed" value={formatNumber(qualityAlerts.failed)} icon={<TriangleAlert className="h-5 w-5" />} color="warning" />
      </div>
    </div>
  );
}

function WorkflowCard({ description, href, icon, label }: { description: string; href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="surface-card group flex items-start justify-between gap-4 bg-gradient-to-br from-white via-white to-amber-50 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex gap-3">
        <span className="app-icon-chip h-11 w-11">{icon}</span>
        <div>
          <p className="font-semibold text-brown">{label}</p>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brown" />
    </Link>
  );
}
