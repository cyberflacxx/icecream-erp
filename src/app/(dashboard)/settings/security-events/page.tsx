'use client';

import { ShieldAlert } from 'lucide-react';

import { EmptyState, LoadingState } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { useSecurityEvents } from '@/hooks/settings/useSettings';

export default function SettingsSecurityEventsPage() {
  const eventsQuery = useSecurityEvents({ page: 1, pageSize: 50 });

  if (eventsQuery.isLoading) {
    return <LoadingState />;
  }

  if (eventsQuery.isError) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Security events unavailable"
        description={eventsQuery.error.message}
      />
    );
  }

  const events = eventsQuery.data?.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Events"
        description="Review login outcomes, timeouts, lockouts, and export activity."
      />
      <SettingsNav />

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted dark:text-darkMuted">No security events recorded yet.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
                <div className="font-medium text-brown dark:text-darkText">{event.event_type}</div>
                <div className="text-muted dark:text-darkMuted">Status: {event.status} | IP: {event.ip_address ?? 'N/A'}</div>
                <div className="text-muted dark:text-darkMuted">{event.created_at}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
