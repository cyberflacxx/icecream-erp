'use client';

import { Rocket } from 'lucide-react';

import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatCard, StatusBadge } from '@/components/ui-library';
import { useApproveGoLive, useCreateDeploymentChecklistItem, useDeploymentChecklist, useDeploymentReadiness, useRequestGoLive, useRunDeploymentReadinessCheck } from '@/hooks/admin/useAdminReadiness';

export default function AdminDeploymentPage() {
  const checklist = useDeploymentChecklist();
  const readiness = useDeploymentReadiness();
  const addItem = useCreateDeploymentChecklistItem();
  const runCheck = useRunDeploymentReadinessCheck();
  const requestGoLive = useRequestGoLive();
  const approveGoLive = useApproveGoLive();
  if (checklist.isLoading || readiness.isLoading) return <LoadingState />;
  if (checklist.isError || readiness.isError || !checklist.data || !readiness.data) return <EmptyState icon={<Rocket className="h-6 w-6" />} title="Deployment readiness unavailable" description={checklist.error?.message ?? readiness.error?.message ?? 'Failed to load readiness data.'} />;

  const items = Array.isArray(checklist.data.items) ? checklist.data.items as Array<Record<string, unknown>> : [];
  const environmentChecks = Array.isArray(readiness.data.environmentChecks) ? readiness.data.environmentChecks as Array<Record<string, unknown>> : [];
  return (
    <div className="space-y-8">
      <PageHeader title="Deployment Readiness" description="Review environment checks, checklist items, blockers, and go-live approval state before production launch." status="partial" actions={<div className="flex gap-2"><Button variant="outline" onClick={() => addItem.mutate({ category: 'Deployment', task: 'Confirm admin user', status: 'NOT_STARTED' })}>Add Checklist Item</Button><Button variant="outline" onClick={() => runCheck.mutate({})}>Run Readiness Check</Button><Button variant="outline" onClick={() => requestGoLive.mutate({})}>Request Go-Live</Button><Button variant="success" onClick={() => approveGoLive.mutate({ approvalRemarks: 'Ready for deployment.' })}>Approve Go-Live</Button></div>} />
      <AdminNav />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Environment Checks" value={String(environmentChecks.length)} icon={<Rocket className="h-5 w-5" />} />
        <StatCard title="Checklist Items" value={String(items.length)} icon={<Rocket className="h-5 w-5" />} color="warning" />
        <StatCard title="Blockers" value={String(readiness.data.blockers ?? 0)} icon={<Rocket className="h-5 w-5" />} color="brown" />
      </div>
      <DataTable data={environmentChecks} columns={[{ key: 'check_name', header: 'Check' }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> }, { key: 'checked_at', header: 'Checked At' }]} emptyState={<EmptyState icon={<Rocket className="h-6 w-6" />} title="No environment checks" description="Run readiness checks to build the go-live view." />} />
      <DataTable data={items} columns={[{ key: 'category', header: 'Category' }, { key: 'task', header: 'Task' }, { key: 'owner', header: 'Owner' }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> }]} emptyState={<EmptyState icon={<Rocket className="h-6 w-6" />} title="No checklist items" description="Add deployment checklist items and track completion status here." />} />
    </div>
  );
}
