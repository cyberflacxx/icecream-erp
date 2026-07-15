'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, Boxes, Factory, FileSpreadsheet, Gauge, PackageOpen, Scale, ShieldAlert, TriangleAlert, TrendingUp, Undo2 } from 'lucide-react';
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

  const { stats, charts, openBatches, materialFlow, materialsAtRisk, qualityAlerts, salesPlanning, shiftSummary } = dashboardQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production Module"
        description="Run production in one straight line: define the BOM, issue raw materials from the production warehouse, then release finished goods back into production inventory."
      />
      <ProductionNav />

      <section className="grid gap-4 md:grid-cols-3">
        <WorkflowCard
          description="Define the raw materials and standard quantity required per finished unit."
          href="/production/recipes"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="1. BOM"
        />
        <WorkflowCard
          description="Enter quantity to produce and issue raw materials from the production warehouse."
          href="/production/batches?stage=issue"
          icon={<Scale className="h-5 w-5" />}
          label="2. Issues"
        />
        <WorkflowCard
          description="Release actual finished output back into the production warehouse inventory."
          href="/production/batches?stage=release"
          icon={<PackageOpen className="h-5 w-5" />}
          label="3. Release"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <WorkflowCard
          description="See the current stock held inside production-controlled inventory."
          href="/inventory/stock-balances"
          icon={<Boxes className="h-5 w-5" />}
          label="Stock Balance"
        />
        <WorkflowCard
          description="Receive materials into production and transfer completed output onward."
          href="/production/transfers"
          icon={<ArrowRight className="h-5 w-5" />}
          label="Transfers In"
        />
        <WorkflowCard
          description="Review variance, material usage, yield, and costing reports."
          href="/production/reports"
          icon={<Gauge className="h-5 w-5" />}
          label="Reports"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Planned Batches" value={formatNumber(stats.plannedBatches)} icon={<PackageOpen className="h-5 w-5" />} />
        <StatCard title="In Progress" value={formatNumber(stats.inProgressBatches)} icon={<Factory className="h-5 w-5" />} color="warning" />
        <StatCard title="Completed Today" value={formatNumber(stats.completedToday)} icon={<ShieldAlert className="h-5 w-5" />} color="success" />
        <StatCard title="Avg Efficiency" value={`${formatNumber(stats.avgEfficiency)}%`} icon={<Gauge className="h-5 w-5" />} color="brown" />
        <StatCard title="Total Wastage" value={formatNumber(stats.totalWastage)} icon={<TriangleAlert className="h-5 w-5" />} color="warning" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Received Today" value={formatNumber(materialFlow.receivedIntoProductionToday)} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Issued" value={formatNumber(materialFlow.issued)} icon={<Scale className="h-5 w-5" />} color="brown" />
        <StatCard title="Consumed" value={formatNumber(materialFlow.consumed)} icon={<Factory className="h-5 w-5" />} color="brown" />
        <StatCard title="Surplus" value={formatNumber(materialFlow.surplus)} icon={<Undo2 className="h-5 w-5" />} color="success" />
        <StatCard title="Returned Today" value={formatNumber(materialFlow.returnedToStoresToday)} icon={<Undo2 className="h-5 w-5" />} color="success" />
        <StatCard title="Damaged Today" value={formatNumber(materialFlow.damagedToday)} icon={<TriangleAlert className="h-5 w-5" />} color="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Output Last 7 Days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={charts.outputLast7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-card-grid)" />
                <XAxis dataKey="day" stroke="var(--dashboard-card-axis)" fontSize={12} />
                <YAxis stroke="var(--dashboard-card-axis)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="output" fill="var(--dashboard-card-fill)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Batch Status Breakdown">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <PieChart>
                <Tooltip />
                <Pie data={charts.statusBreakdown} dataKey="count" nameKey="status" outerRadius={105} fill="var(--dashboard-card-fill)" />
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
            { key: 'runHours', header: 'Run Hrs' },
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

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          columns={[
            { key: 'productName', header: 'Today Sales' },
            { key: 'quantity', header: 'Qty' },
          ]}
          data={salesPlanning.todaySalesByProduct}
          emptyState={<EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No product sales posted today" description="Today&apos;s product sales will appear here for production demand tracking." />}
        />

        <DataTable
          columns={[
            { key: 'productName', header: 'Best Seller' },
            { key: 'quantitySoldLast7Days', header: 'Last 7 Days' },
            { key: 'currentStock', header: 'FG Stock' },
            { key: 'suggestedProductionQuantity', header: 'Suggested Qty' },
          ]}
          data={salesPlanning.bestSellingProducts}
          emptyState={<EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No sales demand yet" description="Best-selling products appear once branch sales start posting." />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          columns={[
            { key: 'productName', header: 'Demand Signal' },
            { key: 'quantitySoldLast7Days', header: '7 Day Sales' },
            { key: 'currentStock', header: 'Current Stock' },
            { key: 'suggestedProductionQuantity', header: 'Suggested Production' },
          ]}
          data={salesPlanning.demandSignals}
          emptyState={<EmptyState icon={<Boxes className="h-6 w-6" />} title="No demand signals" description="Demand planning appears once production and sales history exist together." />}
        />

        <DataTable
          columns={[
            { key: 'date', header: 'Date' },
            { key: 'shift', header: 'Shift' },
            { key: 'batches', header: 'Batches' },
            { key: 'output', header: 'Output' },
            { key: 'wastage', header: 'Wastage' },
          ]}
          data={shiftSummary}
          emptyState={<EmptyState icon={<Factory className="h-6 w-6" />} title="No shift summary" description="Shift-level output and wastage appear here across the selected period." />}
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
