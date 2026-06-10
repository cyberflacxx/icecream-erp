'use client';

import { AlertCircle, Factory, Gauge, PackageOpen, ShieldAlert, TriangleAlert } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { ChartCard, DataTable, EmptyState, LoadingState, StatCard } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { useProductionDashboard } from '@/hooks/production/useProduction';

function formatNumber(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

export default function ProductionPage() {
  const dashboardQuery = useProductionDashboard();

  if (dashboardQuery.isLoading) {
    return <LoadingState />;
  }

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
        description="Track batch execution, quality risk, and raw-material exposure from one production console."
        status="partial"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Planned Batches"
          value={formatNumber(stats.plannedBatches)}
          icon={<PackageOpen className="h-5 w-5" />}
        />
        <StatCard
          title="In Progress"
          value={formatNumber(stats.inProgressBatches)}
          icon={<Factory className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          title="Completed Today"
          value={formatNumber(stats.completedToday)}
          icon={<ShieldAlert className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Avg Efficiency"
          value={`${formatNumber(stats.avgEfficiency)}%`}
          icon={<Gauge className="h-5 w-5" />}
          color="brown"
        />
        <StatCard
          title="Total Wastage"
          value={formatNumber(stats.totalWastage)}
          icon={<TriangleAlert className="h-5 w-5" />}
          color="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Output Last 7 Days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
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
            <ResponsiveContainer width="100%" height="100%">
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
            { key: 'output', header: 'Output' }
          ]}
          data={openBatches}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No open batches"
              description="All batches are currently closed or completed."
            />
          }
        />

        <DataTable
          columns={[
            { key: 'item', header: 'Raw Material' },
            { key: 'warehouse', header: 'Warehouse' },
            { key: 'available', header: 'Available' },
            { key: 'reorderLevel', header: 'Reorder Level' },
            { key: 'deficit', header: 'Deficit' }
          ]}
          data={materialsAtRisk}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No material risk"
              description="No raw materials are currently below reorder level."
            />
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard title="Quality Pending" value={formatNumber(qualityAlerts.pending)} icon={<ShieldAlert className="h-5 w-5" />} color="brown" />
        <StatCard title="Quality Failed" value={formatNumber(qualityAlerts.failed)} icon={<TriangleAlert className="h-5 w-5" />} color="warning" />
      </div>
    </div>
  );
}

