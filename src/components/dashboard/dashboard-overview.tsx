'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Boxes,
  ClipboardList,
  DollarSign,
  Gauge,
  PackageOpen,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import {
  ChartCard,
  DataTable,
  EmptyState,
  LoadingState,
  StatCard,
  StatusBadge
} from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { WelcomeModal } from '@/components/dashboard/welcome-modal';
import { useUserContext } from '@/contexts/UserContext';
import { useBranchRealtime } from '@/hooks/branch-operations/useBranchRealtime';
import { useDashboardMetrics } from '@/hooks/reports/useReports';

function formatNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric.toLocaleString() : '0';
}

export function DashboardOverview() {
  const router = useRouter();
  const { currentUser, isLoading } = useUserContext();
  const dashboardQuery = useDashboardMetrics();
  const dashboardData = dashboardQuery.data as Record<string, unknown> | undefined;
  const role = String(dashboardData?.role ?? '');
  const branchId = currentUser?.branch?.id;
  const realtimeHandlers = useMemo(
    () => ({
      onSale: () => void dashboardQuery.refetch(),
      onShiftClose: () => void dashboardQuery.refetch()
    }),
    [dashboardQuery],
  );

  useBranchRealtime(role === 'branch_manager' ? branchId : undefined, realtimeHandlers);

  useEffect(() => {
    if (!dashboardQuery.isError) {
      return;
    }

    const message = dashboardQuery.error?.message?.toLowerCase() ?? '';
    const isAuthError =
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('token') ||
      message.includes('session');

    if (isAuthError) {
      router.replace('/auth/login');
    }
  }, [dashboardQuery.error?.message, dashboardQuery.isError, router]);

  if (isLoading || dashboardQuery.isLoading) {
    return <LoadingState />;
  }

  if (dashboardQuery.isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Dashboard data unavailable"
        description={dashboardQuery.error.message}
      />
    );
  }

  if (!dashboardData) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="No dashboard data"
        description="Dashboard metrics are not available for this account yet."
      />
    );
  }

  const roleLabel =
    role === 'system_admin'
      ? 'System Admin'
      : role === 'production_manager'
        ? 'Production Manager'
        : role === 'branch_manager'
          ? 'Branch Manager'
          : 'Operations Specialist';

  if (role === 'system_admin') {
    const stats = (dashboardData.stats ?? {}) as {
      production?: Record<string, number>;
      sales?: Record<string, number>;
    };
    const productionSummary = stats.production ?? {};
    const salesSummary = stats.sales ?? {};
    const productionLast7Days =
      ((dashboardData.charts as { productionLast7Days?: Array<Record<string, unknown>> } | undefined)
        ?.productionLast7Days ?? []) as Array<Record<string, unknown>>;
    const salesLast7Days =
      ((dashboardData.charts as { salesLast7Days?: Array<Record<string, unknown>> } | undefined)
        ?.salesLast7Days ?? []) as Array<Record<string, unknown>>;
    const lowStockTop5 = (dashboardData.lowStockTop5 ?? []) as Array<Record<string, unknown>>;
    const recentAuditLogs = (dashboardData.recentAuditLogs ?? []) as Array<Record<string, unknown>>;
    const openBatches = (dashboardData.openProductionBatches ?? []) as Array<Record<string, unknown>>;

    return (
      <div className="space-y-8">
        <PageHeader
          title={`Welcome back, ${currentUser?.profile?.firstName ?? 'team'}`}
          description={`${roleLabel} dashboard with live production, sales, stock, and audit visibility.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="7-Day Output"
            value={formatNumber(productionSummary.totalOutput)}
            icon={<PackageOpen className="h-5 w-5" />}
            trendValue={`${formatNumber(productionSummary.batches)} batches`}
          />
          <StatCard
            title="7-Day Sales"
            value={formatNumber(salesSummary.totalSales)}
            icon={<DollarSign className="h-5 w-5" />}
            color="success"
            trendValue={`${formatNumber(salesSummary.totalTransactions)} transactions`}
          />
          <StatCard
            title="Avg Efficiency"
            value={`${Number(productionSummary.avgEfficiency ?? 0).toFixed(1)}%`}
            icon={<Gauge className="h-5 w-5" />}
            color="warning"
          />
          <StatCard
            title="Total Wastage"
            value={formatNumber(productionSummary.totalWastage)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="warning"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Production Output (Last 7 Days)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productionLast7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="output" fill="#F97316" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Sales Trend (Last 7 Days)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesLast7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <DataTable
          columns={[
            { key: 'item', header: 'Item' },
            { key: 'warehouse', header: 'Warehouse' },
            { key: 'available', header: 'Available' },
            { key: 'reorderLevel', header: 'Reorder Level' },
            { key: 'deficit', header: 'Deficit' }
          ]}
          data={lowStockTop5}
          emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No low stock items" description="Top 5 table is currently empty." />}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <DataTable
            columns={[
              { key: 'action', header: 'Action' },
              { key: 'entityType', header: 'Entity' },
              { key: 'entityId', header: 'Reference' },
              {
                key: 'createdAt',
                header: 'Timestamp',
                render: (row: Record<string, unknown>) =>
                  row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : 'N/A'
              }
            ]}
            data={recentAuditLogs}
            emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No recent audit logs" description="No entries were returned." />}
          />

          <DataTable
            columns={[
              { key: 'batchNumber', header: 'Batch #' },
              {
                key: 'status',
                header: 'Status',
                render: (row: Record<string, unknown>) => <StatusBadge status={String(row.status ?? '')} />
              },
              {
                key: 'productionDate',
                header: 'Production Date',
                render: (row: Record<string, unknown>) =>
                  row.productionDate ? new Date(String(row.productionDate)).toLocaleDateString() : 'N/A'
              },
              { key: 'shift', header: 'Shift' }
            ]}
            data={openBatches}
            emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No open production batches" description="All batches are currently closed." />}
          />
        </div>
      </div>
    );
  }

  if (role === 'production_manager') {
    const stats = (dashboardData.stats ?? {}) as Record<string, number>;
    const charts = (dashboardData.charts ?? {}) as {
      efficiencyGauge?: Record<string, number>;
      wastageTrend?: Array<Record<string, unknown>>;
    };
    const efficiencyValue = Number(charts.efficiencyGauge?.avgEfficiency ?? 0);
    const wastageTrend = (charts.wastageTrend ?? []) as Array<Record<string, unknown>>;
    const rawMaterialAvailability = (dashboardData.rawMaterialAvailability ?? []) as Array<Record<string, unknown>>;
    const activeWorkersCount = Number(dashboardData.activeWorkersCount ?? 0);

    return (
      <div className="space-y-8">
        <PageHeader
          title={`Welcome back, ${currentUser?.profile?.firstName ?? 'team'}`}
          description={`${roleLabel} dashboard with live production throughput, efficiency, and material health.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Today's Output"
            value={formatNumber(stats.totalOutput)}
            icon={<Activity className="h-5 w-5" />}
            trendValue={`${formatNumber(stats.batches)} batches`}
          />
          <StatCard
            title="Avg Efficiency"
            value={`${Number(stats.avgEfficiency ?? 0).toFixed(1)}%`}
            icon={<Gauge className="h-5 w-5" />}
            color="success"
          />
          <StatCard
            title="Today's Wastage"
            value={formatNumber(stats.totalWastage)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="warning"
          />
          <StatCard
            title="Active Workers"
            value={formatNumber(activeWorkersCount)}
            icon={<Users className="h-5 w-5" />}
            color="brown"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Efficiency Gauge">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={[
                      { label: 'Efficiency', value: Math.max(0, Math.min(100, efficiencyValue)) },
                      { label: 'Remaining', value: Math.max(0, 100 - efficiencyValue) }
                    ]}
                    dataKey="value"
                    nameKey="label"
                    outerRadius={105}
                    fill="#F97316"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Wastage Trend (Last 7 Days)">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wastageTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="wastage" stroke="#F97316" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <DataTable
          columns={[
            { key: 'item', header: 'Raw Material' },
            { key: 'warehouse', header: 'Warehouse' },
            { key: 'quantityAvailable', header: 'Available' },
            { key: 'quantityOnHand', header: 'On Hand' },
            { key: 'reorderLevel', header: 'Reorder Level' }
          ]}
          data={rawMaterialAvailability}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No raw material data"
              description="No raw material balances were returned for the selected scope."
            />
          }
        />
      </div>
    );
  }

  if (role === 'operations_specialist') {
    const summary = (dashboardData.summary ?? {}) as Record<string, unknown>;
    const chartData = (dashboardData.chart ?? []) as Array<Record<string, unknown>>;
    const dataPreview = (dashboardData.dataPreview ?? []) as Array<Record<string, unknown>>;
    const focus = String(dashboardData.focus ?? 'general');
    const reportType = String(dashboardData.reportType ?? 'n/a');
    const summaryEntries = Object.entries(summary);
    const summaryCards = summaryEntries.length
      ? summaryEntries
      : [['message', 'No scoped summary data available']] as Array<[string, unknown]>;
    const previewColumns = Object.keys(dataPreview[0] ?? {}).map((key) => ({
      key,
      header: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    }));
    const numericKeys = Array.from(
      chartData.reduce((keys, row) => {
        Object.entries(row).forEach(([key, value]) => {
          if (typeof value === 'number') {
            keys.add(key);
          }
        });

        return keys;
      }, new Set<string>()),
    );
    const xAxisKey = chartData[0] ? Object.keys(chartData[0])[0] : 'label';
    const primaryMetric = numericKeys[0] ?? 'value';

    return (
      <div className="space-y-8">
        <PageHeader
          title={`Welcome back, ${currentUser?.profile?.firstName ?? 'team'}`}
          description={`${roleLabel} dashboard focused on ${focus.replace(/_/g, ' ')} data only.`}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.slice(0, 4).map(([key, value]) => (
            <StatCard
              key={key}
              title={key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
              value={String(value)}
              icon={<Activity className="h-5 w-5" />}
            />
          ))}
        </div>

        <ChartCard title={`Scoped Report Snapshot: ${reportType}`}>
          {chartData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey={xAxisKey} stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey={primaryMetric} fill="#F97316" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No scoped chart data"
              description="No chart points were returned for your role scope."
            />
          )}
        </ChartCard>

        <DataTable
          columns={previewColumns}
          data={dataPreview}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No scoped rows"
              description="No preview rows are available for your role scope."
            />
          }
        />
      </div>
    );
  }

  const stats = (dashboardData.stats ?? {}) as Record<string, unknown>;
  const charts = (dashboardData.charts ?? {}) as {
    paymentBreakdown?: Record<string, number>;
  };
  const paymentBreakdown = Object.entries(charts.paymentBreakdown ?? {}).map(([method, total]) => ({
    method,
    total
  }));
  const shiftCloseStatus = (dashboardData.shiftCloseStatus ?? null) as Record<string, unknown> | null;

  return (
    <div className="space-y-8">
      <WelcomeModal firstName={currentUser?.profile?.firstName} />
      <PageHeader
        title={`Welcome back, ${currentUser?.profile?.firstName ?? 'team'}`}
        description={`${roleLabel} dashboard with live branch sales monitoring and shift close visibility.`}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value={formatNumber(stats.totalSales)}
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Transactions"
          value={formatNumber((stats.paymentBreakdown as Record<string, number> | undefined) ? Object.values(stats.paymentBreakdown as Record<string, number>).reduce((sum, value) => sum + value, 0) : 0)}
          icon={<ClipboardList className="h-5 w-5" />}
          color="brown"
          trendValue="Payment aggregate"
        />
        <StatCard
          title="Realtime Feed"
          value="Active"
          icon={<Activity className="h-5 w-5" />}
          color="warning"
          trendValue="Supabase listeners connected"
        />
        <StatCard
          title="Branch Scope"
          value={currentUser?.branch?.code ?? 'GLOBAL'}
          icon={<Boxes className="h-5 w-5" />}
          color="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Payment Breakdown">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie data={paymentBreakdown} dataKey="total" nameKey="method" outerRadius={105} fill="#F97316" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">Shift Close Status</p>
          {shiftCloseStatus ? (
            <div className="mt-6 space-y-3 text-sm text-muted">
              <p>
                <span className="font-semibold text-brown">Branch:</span> {String(shiftCloseStatus.branch ?? currentUser?.branch?.name ?? 'N/A')}
              </p>
              <p>
                <span className="font-semibold text-brown">Shift Date:</span> {String(shiftCloseStatus.shiftDate ?? 'N/A')}
              </p>
              <p className="flex items-center gap-2">
                <span className="font-semibold text-brown">Status:</span>
                <StatusBadge status={String(shiftCloseStatus.status ?? 'UNKNOWN')} />
              </p>
              <p>
                <span className="font-semibold text-brown">Expected Cash:</span> {formatNumber(shiftCloseStatus.expectedCash)}
              </p>
              <p>
                <span className="font-semibold text-brown">Actual Cash:</span> {formatNumber(shiftCloseStatus.actualCash)}
              </p>
            </div>
          ) : (
            <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No shift close yet" description="No shift close record was found for today." />
          )}
        </div>
      </div>
    </div>
  );
}

