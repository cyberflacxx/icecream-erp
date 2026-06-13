'use client';

import { Bug, ClipboardCheck, ClipboardList, GraduationCap } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { EmptyState, LoadingState, StatCard } from '@/components/ui-library';
import { useTestingDashboard } from '@/hooks/testing/useTesting';

export default function TestingDashboardPage() {
  const query = useTestingDashboard();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="Testing dashboard unavailable" description={query.error?.message ?? 'Failed to load testing data.'} />;
  }

  const data = query.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Testing Dashboard" description="Track end-to-end testing, UAT readiness, bug backlog, training progress, and handover status before go-live." status="partial" />
      <TestingNav />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Cases" value={String(data.totalTestCases ?? 0)} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Passed" value={String(data.passedTestCases ?? 0)} icon={<ClipboardCheck className="h-5 w-5" />} color="success" />
        <StatCard title="Failed" value={String(data.failedTestCases ?? 0)} icon={<Bug className="h-5 w-5" />} color="brown" />
        <StatCard title="Critical Bugs" value={String(data.criticalBugs ?? 0)} icon={<Bug className="h-5 w-5" />} color="warning" />
        <StatCard title="Handover" value={String(data.handoverReadiness ?? 'PENDING')} icon={<GraduationCap className="h-5 w-5" />} color="success" />
      </div>
    </div>
  );
}
