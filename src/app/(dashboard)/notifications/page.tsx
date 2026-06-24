'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { NotificationNav } from '@/components/notifications/notification-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useDismissNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsList } from '@/hooks/useNotifications';

export default function NotificationCenterPage() {
  const [severity, setSeverity] = useState('');
  const [moduleName, setModuleName] = useState('');
  const query = useNotificationsList({ page: 1, pageSize: 50, severity: severity || undefined, module: moduleName || undefined });
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();
  const markAll = useMarkAllNotificationsRead();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<BellRing className="h-6 w-6" />} title="Notifications unavailable" description={query.error?.message ?? 'Failed to load notifications.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notification Center"
        description="Review unread, critical, and module-specific alerts, then open, read, or dismiss them."
        status="partial"
        actions={<Button onClick={() => markAll.mutate()}>Mark all read</Button>}
      />
      <NotificationNav />
      <section className="surface-card grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-muted dark:text-darkMuted">
          <span>Severity filter</span>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="surface-input">
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-muted dark:text-darkMuted">
          <span>Module filter</span>
          <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder="inventory, finance, sales..." className="surface-input" />
        </label>
      </section>
      <DataTable
        data={query.data.data}
        pagination={query.data.pagination}
        columns={[
          { key: 'title', header: 'Alert', render: (row) => <div><div className="font-semibold">{row.title}</div><div className="text-xs text-muted dark:text-darkMuted">{row.message}</div></div> },
          { key: 'severity', header: 'Severity', render: (row) => <StatusBadge status={row.severity} /> },
          { key: 'module', header: 'Module', render: (row) => row.module || 'SYSTEM' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'createdAt', header: 'Date', render: (row) => new Date(row.createdAt).toLocaleString() },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => markRead.mutate(row.id)}>Read</Button>
                <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(row.id)}>Dismiss</Button>
              </div>
            ),
          },
        ]}
        emptyState={<EmptyState icon={<BellRing className="h-6 w-6" />} title="No notifications found" description="Try a different filter or wait for the next business event." />}
      />
    </div>
  );
}
