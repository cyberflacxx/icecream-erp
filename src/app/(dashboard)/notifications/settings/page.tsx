'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Settings2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { NotificationNav } from '@/components/notifications/notification-nav';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useAppAuth } from '@/hooks/useAppAuth';
import {
  useCreateEscalationRule,
  useCreateNotificationRule,
  useCreateNotificationTemplate,
  useCreateReminderRule,
  useNotificationSettings,
  useSendNotificationTest,
  useUpdateNotificationPreferences,
} from '@/hooks/useNotifications';

function Card({ title, children }: { children: ReactNode; title: string }) {
  return (
    <section className="surface-card-lg space-y-4">
      <h3 className="text-lg font-semibold text-brown dark:text-darkText">{title}</h3>
      {children}
    </section>
  );
}

export default function NotificationSettingsPage() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const query = useNotificationSettings();
  const createRule = useCreateNotificationRule();
  const createTemplate = useCreateNotificationTemplate();
  const createEscalation = useCreateEscalationRule();
  const createReminder = useCreateReminderRule();
  const updatePreferences = useUpdateNotificationPreferences();
  const sendTest = useSendNotificationTest();
  const [message, setMessage] = useState<string | null>(null);

  if (!isLoaded || (isSignedIn && query.isPending && !query.data)) return <LoadingState />;
  if (!isSignedIn) {
    return <EmptyState icon={<Settings2 className="h-6 w-6" />} title="Sign in required" description="Sign in to manage notification settings." />;
  }
  if (query.isError) {
    return <EmptyState icon={<Settings2 className="h-6 w-6" />} title="Notification settings unavailable" description={query.error?.message ?? 'Failed to load notification settings.'} />;
  }

  const settingsData = query.data ?? {};
  const rules = Array.isArray(settingsData.rules) ? settingsData.rules as Array<Record<string, unknown>> : [];
  const templates = Array.isArray(settingsData.templates) ? settingsData.templates as Array<Record<string, unknown>> : [];
  const preferences = Array.isArray(settingsData.preferences) ? settingsData.preferences as Array<Record<string, unknown>> : [];
  const escalationRules = Array.isArray(settingsData.escalationRules) ? settingsData.escalationRules as Array<Record<string, unknown>> : [];
  const reminderRules = Array.isArray(settingsData.reminderRules) ? settingsData.reminderRules as Array<Record<string, unknown>> : [];

  return (
    <div className="space-y-8">
      <PageHeader title="Notification Settings" description="Configure rules, templates, user preferences, escalation paths, reminder rules, and test alerts." status="partial" />
      <NotificationNav />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Create Rule">
          <Button
            onClick={async () => {
              try {
                await createRule.mutateAsync({
                  ruleName: 'Low stock escalation',
                  module: 'inventory',
                  eventType: 'LOW_STOCK',
                  severity: 'HIGH',
                  recipientRoleName: 'Stores Manager',
                  channel: 'IN_APP',
                });
                setMessage('Notification rule created.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Failed to create rule.');
              }
            }}
          >
            Add default low stock rule
          </Button>
          <div className="space-y-2 text-sm text-brown dark:text-darkText">
            {rules.slice(0, 6).map((rule) => (
              <div key={String(rule.id)} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 dark:border-darkBorder">
                <div>
                  <div className="font-semibold">{String(rule.rule_name ?? '')}</div>
                  <div className="text-xs text-muted dark:text-darkMuted">{String(rule.module_name ?? '')} / {String(rule.event_type ?? '')}</div>
                </div>
                <StatusBadge status={String(rule.severity ?? 'INFO')} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Create Template">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await createTemplate.mutateAsync({
                  templateName: 'Generic low stock',
                  module: 'inventory',
                  eventType: 'LOW_STOCK',
                  titleTemplate: 'Low stock: {{itemName}}',
                  messageTemplate: '{{itemName}} is at {{quantityOnHand}} units against reorder level {{reorderLevel}}.',
                  channel: 'IN_APP',
                });
                setMessage('Notification template created.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Failed to create template.');
              }
            }}
          >
            Add low stock template
          </Button>
          <div className="space-y-2 text-sm text-brown dark:text-darkText">
            {templates.slice(0, 6).map((template) => (
              <div key={String(template.id)} className="rounded-xl border border-border px-4 py-3 dark:border-darkBorder">
                <div className="font-semibold">{String(template.template_name ?? '')}</div>
                <div className="text-xs text-muted dark:text-darkMuted">{String(template.module_name ?? '')} / {String(template.event_type ?? '')}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Preferences">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await updatePreferences.mutateAsync([
                  { module: 'inventory', channel: 'IN_APP', minimumSeverity: 'LOW', enabled: true },
                  { module: 'finance', channel: 'IN_APP', minimumSeverity: 'MEDIUM', enabled: true },
                ]);
                setMessage('Notification preferences updated.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Failed to update preferences.');
              }
            }}
          >
            Save default preferences
          </Button>
          <div className="space-y-2 text-sm text-brown dark:text-darkText">
            {preferences.slice(0, 6).map((preference) => (
              <div key={String(preference.id)} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 dark:border-darkBorder">
                <div>{String(preference.module_name ?? '')} / {String(preference.channel ?? '')}</div>
                <StatusBadge status={String(preference.minimum_severity ?? 'INFO')} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Escalation and Reminders">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await createEscalation.mutateAsync({
                    module: 'finance',
                    eventType: 'RECEIVABLE_OVERDUE',
                    initialRecipientRoleName: 'Accountant',
                    escalationRecipientRoleName: 'Finance Manager',
                    escalationDelayMinutes: 60,
                    severity: 'HIGH',
                  });
                  setMessage('Escalation rule created.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Failed to create escalation rule.');
                }
              }}
            >
              Add escalation rule
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await createReminder.mutateAsync({
                    module: 'branch operations',
                    documentType: 'branch_shift_close',
                    reminderEvent: 'BRANCH_SHIFT_CLOSURE_DUE',
                    dueTimeRule: '30 minutes before shift closure',
                    recipientRoleName: 'Branch Controller',
                    message: 'Branch shift closure is due.',
                  });
                  setMessage('Reminder rule created.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Failed to create reminder rule.');
                }
              }}
            >
              Add reminder rule
            </Button>
            <Button
              onClick={async () => {
                try {
                  await sendTest.mutateAsync({
                    module: 'system',
                    eventType: 'SYSTEM_TEST',
                    severity: 'INFO',
                    title: 'Notification test',
                    message: 'Test notification generated from the settings page.',
                  });
                  setMessage('Test notification sent.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Failed to send test notification.');
                }
              }}
            >
              Send test alert
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm text-brown dark:text-darkText">
              {escalationRules.slice(0, 4).map((rule) => (
                <div key={String(rule.id)} className="rounded-xl border border-border px-4 py-3 dark:border-darkBorder">
                  <div className="font-semibold">{String(rule.event_type ?? '')}</div>
                  <div className="text-xs text-muted dark:text-darkMuted">{String(rule.initial_recipient_role_name ?? '')} to {String(rule.escalation_recipient_role_name ?? '')}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm text-brown dark:text-darkText">
              {reminderRules.slice(0, 4).map((rule) => (
                <div key={String(rule.id)} className="rounded-xl border border-border px-4 py-3 dark:border-darkBorder">
                  <div className="font-semibold">{String(rule.reminder_event ?? '')}</div>
                  <div className="text-xs text-muted dark:text-darkMuted">{String(rule.document_type ?? '')}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {message ? <div className="surface-message">{message}</div> : null}
    </div>
  );
}
