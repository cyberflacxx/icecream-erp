'use client';

import { ShieldCheck } from 'lucide-react';

import { EmptyState, LoadingState } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { useBranchAssignments, useWarehouseAssignments } from '@/hooks/settings/useSettings';

export default function SettingsAccessPage() {
  const branchAssignmentsQuery = useBranchAssignments();
  const warehouseAssignmentsQuery = useWarehouseAssignments();

  if (branchAssignmentsQuery.isLoading || warehouseAssignmentsQuery.isLoading) {
    return <LoadingState />;
  }

  if (branchAssignmentsQuery.isError || warehouseAssignmentsQuery.isError) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Access assignments unavailable"
        description={branchAssignmentsQuery.error?.message ?? warehouseAssignmentsQuery.error?.message ?? 'Failed to load assignments.'}
      />
    );
  }

  const branchAssignments = branchAssignmentsQuery.data ?? [];
  const warehouseAssignments = warehouseAssignmentsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Access Assignments"
        description="Review branch and warehouse scope assignments applied to users."
      />
      <SettingsNav />

      <section className="surface-card-lg">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Branch Access</h3>
        <div className="mt-4 space-y-3">
          {branchAssignments.length === 0 ? (
            <p className="text-sm text-muted dark:text-darkMuted">No branch assignments found.</p>
          ) : (
            branchAssignments.map((assignment) => (
              <div key={String(assignment.id)} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
                User {String(assignment.user_profile_id)} {'->'} Branch {String(assignment.branch_id)} ({String(assignment.role_name ?? 'Scoped access')})
              </div>
            ))
          )}
        </div>
      </section>

      <section className="surface-card-lg">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Warehouse Access</h3>
        <div className="mt-4 space-y-3">
          {warehouseAssignments.length === 0 ? (
            <p className="text-sm text-muted dark:text-darkMuted">No warehouse assignments found.</p>
          ) : (
            warehouseAssignments.map((assignment) => (
              <div key={String(assignment.id)} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
                User {String(assignment.user_profile_id)} {'->'} Warehouse {String(assignment.warehouse_id)} ({String(assignment.access_level ?? 'Assigned')})
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
