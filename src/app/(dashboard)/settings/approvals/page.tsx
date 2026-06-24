'use client';

import { ShieldCheck } from 'lucide-react';

import { EmptyState, LoadingState } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { useApprovalRules, usePendingApprovals } from '@/hooks/settings/useSettings';

export default function SettingsApprovalsPage() {
  const rulesQuery = useApprovalRules();
  const approvalsQuery = usePendingApprovals();

  if (rulesQuery.isLoading || approvalsQuery.isLoading) {
    return <LoadingState />;
  }

  if (rulesQuery.isError || approvalsQuery.isError) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Approvals unavailable"
        description={rulesQuery.error?.message ?? approvalsQuery.error?.message ?? 'Failed to load approval data.'}
      />
    );
  }

  const rules = rulesQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Approval Controls"
        description="Review approval workflows and pending approval requests."
      />
      <SettingsNav />

      <section className="surface-card-lg">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Approval Rules</h3>
        <div className="mt-4 space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-muted dark:text-darkMuted">No approval rules configured.</p>
          ) : (
            rules.map((rule) => (
              <div key={String(rule.id)} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
                <div className="font-medium text-brown dark:text-darkText">{String(rule.name)}</div>
                <div className="text-muted dark:text-darkMuted">{String(rule.entity_type)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="surface-card-lg">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Pending Approvals</h3>
        <div className="mt-4 space-y-3">
          {approvals.length === 0 ? (
            <p className="text-sm text-muted dark:text-darkMuted">No approval requests found.</p>
          ) : (
            approvals.map((approval) => (
              <div key={String(approval.id)} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
                <div className="font-medium text-brown dark:text-darkText">{String(approval.entity_type)} / {String(approval.entity_id)}</div>
                <div className="text-muted dark:text-darkMuted">Status: {String(approval.status)}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
