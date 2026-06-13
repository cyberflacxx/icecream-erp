'use client';

import { Activity } from 'lucide-react';

import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useRunSystemHealthCheck, useSystemHealth } from '@/hooks/admin/useAdminReadiness';

export default function AdminHealthPage() {
  const query = useSystemHealth();
  const runCheck = useRunSystemHealthCheck();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <EmptyState icon={<Activity className="h-6 w-6" />} title="System health unavailable" description={query.error?.message ?? 'Failed to load health checks.'} />;
  const checks = Array.isArray(query.data.checks) ? query.data.checks as Array<Record<string, unknown>> : [];
  const metrics = Array.isArray(query.data.metrics) ? query.data.metrics as Array<Record<string, unknown>> : [];
  return (
    <div className="space-y-8">
      <PageHeader title="System Health" description="Check database connectivity, environment configuration, and service readiness before go-live." status="partial" actions={<Button onClick={() => runCheck.mutate({})}>Run Health Check</Button>} />
      <AdminNav />
      <DataTable data={checks} columns={[{ key: 'check_type', header: 'Check Type' }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> }, { key: 'checked_at', header: 'Checked At' }]} emptyState={<EmptyState icon={<Activity className="h-6 w-6" />} title="No health checks" description="Run the first health check to populate service metrics." />} />
      <DataTable data={metrics} columns={[{ key: 'metric_name', header: 'Metric' }, { key: 'metric_value', header: 'Value' }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> }]} emptyState={<EmptyState icon={<Activity className="h-6 w-6" />} title="No health metrics" description="Metrics appear after a health run." />} />
    </div>
  );
}
