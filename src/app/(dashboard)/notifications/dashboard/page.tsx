'use client';

import { AlertTriangle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { NotificationNav } from '@/components/notifications/notification-nav';
import { DataTable, EmptyState, LoadingState, StatCard, StatusBadge } from '@/components/ui-library';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useNotificationAlertDashboard } from '@/hooks/useNotifications';

export default function NotificationAlertDashboardPage() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const query = useNotificationAlertDashboard();
  if (!isLoaded || (isSignedIn && query.isPending && !query.data)) return <LoadingState />;
  if (!isSignedIn) {
    return <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Sign in required" description="Sign in to view the alert dashboard." />;
  }
  if (query.isError) {
    return <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Alert dashboard unavailable" description={query.error?.message ?? 'Failed to load the alert dashboard.'} />;
  }

  const dashboardData = query.data ?? {};
  const stats = (dashboardData.stats ?? {}) as Record<string, number>;
  const lowStockAlerts = Array.isArray(dashboardData.lowStockAlerts) ? dashboardData.lowStockAlerts as Array<Record<string, unknown>> : [];
  const overdueInvoices = Array.isArray(dashboardData.overdueInvoices) ? dashboardData.overdueInvoices as Array<Record<string, unknown>> : [];

  return (
    <div className="space-y-8">
      <PageHeader title="Alert Dashboard" description="Track critical alerts, operational bottlenecks, overdue balances, shortages, and security exceptions." status="partial" />
      <NotificationNav />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Critical Alerts" value={String(stats.criticalAlerts ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} color="warning" />
        <StatCard title="Pending Approvals" value={String(stats.pendingApprovals ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Low Stock" value={String(stats.lowStockAlerts ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} color="danger" />
        <StatCard title="Security Alerts" value={String(stats.securityAlerts ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} color="success" />
      </div>
      <DataTable
        data={lowStockAlerts}
        columns={[
          { key: 'itemName', header: 'Low Stock Item' },
          { key: 'code', header: 'Code' },
          { key: 'quantityOnHand', header: 'On Hand' },
          { key: 'reorderLevel', header: 'Reorder Level' },
        ]}
        emptyState={<EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No low stock alerts" description="Current inventory balances are above reorder thresholds." />}
      />
      <DataTable
        data={overdueInvoices}
        columns={[
          { key: 'invoiceNumber', header: 'Invoice' },
          { key: 'customerName', header: 'Customer' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'balanceDue', header: 'Balance' },
          { key: 'severity', header: 'Status', render: () => <StatusBadge status="OVERDUE" /> },
        ]}
        emptyState={<EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No overdue invoices" description="Receivables are current for the active organization." />}
      />
    </div>
  );
}
