'use client';

import { Clock3 } from 'lucide-react';

import { EmptyState, LoadingState } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { useSecuritySessions } from '@/hooks/settings/useSettings';

export default function SettingsSessionsPage() {
  const sessionsQuery = useSecuritySessions();

  if (sessionsQuery.isLoading) {
    return <LoadingState />;
  }

  if (sessionsQuery.isError) {
    return (
      <EmptyState
        icon={<Clock3 className="h-6 w-6" />}
        title="Sessions unavailable"
        description={sessionsQuery.error.message}
      />
    );
  }

  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Session Management"
        description="Track active user sessions, recent activity, and expiry windows."
      />
      <SettingsNav />

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted dark:text-darkMuted">No active sessions found.</p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
                <div className="font-medium text-brown dark:text-darkText">Session {session.id.slice(0, 12)}...</div>
                <div className="text-muted dark:text-darkMuted">User: {session.userId} | Status: {session.status}</div>
                <div className="text-muted dark:text-darkMuted">Last activity: {session.lastActivityAt}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
