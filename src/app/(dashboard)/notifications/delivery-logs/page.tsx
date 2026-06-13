'use client';

import { Send } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { NotificationNav } from '@/components/notifications/notification-nav';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useNotificationDeliveryLogs } from '@/hooks/useNotifications';

export default function NotificationDeliveryLogsPage() {
  const query = useNotificationDeliveryLogs();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<Send className="h-6 w-6" />} title="Delivery logs unavailable" description={query.error?.message ?? 'Failed to load delivery logs.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Notification Delivery Logs" description="Review in-app delivery attempts, statuses, and failed downstream channels." status="partial" />
      <NotificationNav />
      <DataTable
        data={query.data}
        columns={[
          { key: 'notification_id', header: 'Notification' },
          { key: 'recipient_user_id', header: 'Recipient' },
          { key: 'channel', header: 'Channel' },
          { key: 'delivery_status', header: 'Status', render: (row) => <StatusBadge status={String(row.delivery_status ?? '')} /> },
          { key: 'sent_at', header: 'Sent At', render: (row) => row.sent_at ? new Date(String(row.sent_at)).toLocaleString() : 'Pending' },
          { key: 'failure_reason', header: 'Failure Reason' },
        ]}
        emptyState={<EmptyState icon={<Send className="h-6 w-6" />} title="No delivery logs" description="Delivery attempts will appear here after alerts are generated." />}
      />
    </div>
  );
}
