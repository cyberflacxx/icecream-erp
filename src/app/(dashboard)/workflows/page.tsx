'use client';

import { Clock3, GitCompareArrows, ShieldCheck, Stamp } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { WorkflowNav } from '@/components/workflows/workflow-nav';
import { WorkflowTimeline } from '@/components/workflows/workflow-timeline';
import { EmptyState, LoadingState, StatCard } from '@/components/ui-library';
import { useWorkflowDashboard } from '@/hooks/workflows/useWorkflows';

export default function WorkflowDashboardPage() {
  const query = useWorkflowDashboard();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Workflow dashboard unavailable" description={query.error?.message ?? 'Failed to load workflow dashboard.'} />;
  }
  const data = query.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Workflow Dashboard" description="Monitor pending approvals, postings, corrections, reversals, and recent workflow actions." status="partial" />
      <WorkflowNav />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending Approvals" value={String(data.pendingApprovals ?? 0)} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard title="Pending Postings" value={String(data.pendingPostings ?? 0)} icon={<Stamp className="h-5 w-5" />} color="brown" />
        <StatCard title="Corrections" value={String(data.correctionRequests ?? 0)} icon={<GitCompareArrows className="h-5 w-5" />} color="warning" />
        <StatCard title="Overdue" value={String(data.overdueApprovals ?? 0)} icon={<Clock3 className="h-5 w-5" />} color="success" />
      </div>
      <WorkflowTimeline items={Array.isArray(data.recentWorkflowActions) ? data.recentWorkflowActions as Array<Record<string, unknown>> : []} />
    </div>
  );
}
