'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { EmptyState, LoadingState } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { useSecuritySettings, useUpdateSecuritySettings, type SecuritySettingsResponse } from '@/hooks/settings/useSettings';

const inputClass =
  'h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText';

export default function SettingsSecuritySettingsPage() {
  const settingsQuery = useSecuritySettings();
  const updateSettings = useUpdateSecuritySettings();
  const [form, setForm] = useState<SecuritySettingsResponse | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading || !form) {
    return <LoadingState />;
  }

  if (settingsQuery.isError) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Security settings unavailable"
        description={settingsQuery.error.message}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Settings"
        description="Configure session timeout, failed login limits, and password rules."
        actions={
          <Button
            onClick={async () => {
              await updateSettings.mutateAsync(form);
            }}
          >
            Save Security Settings
          </Button>
        }
      />
      <SettingsNav />

      <section className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm md:grid-cols-2 dark:border-darkBorder dark:bg-darkCard">
        {(
          [
            ['sessionTimeoutMinutes', 'Session timeout (minutes)'],
            ['failedLoginLimit', 'Failed login limit'],
            ['lockoutDurationMinutes', 'Lockout duration (minutes)'],
            ['passwordMinLength', 'Password minimum length'],
          ] as Array<[keyof SecuritySettingsResponse, string]>
        ).map(([key, label]) => (
          <label key={key} className="space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>{label}</span>
            <input
              type="number"
              min={1}
              value={String(form[key])}
              onChange={(event) => setForm((current) => current ? { ...current, [key]: Number(event.target.value) } : current)}
              className={inputClass}
            />
          </label>
        ))}
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-white p-6 shadow-sm md:grid-cols-2 dark:border-darkBorder dark:bg-darkCard">
        {(
          [
            ['requireUppercase', 'Require uppercase letters'],
            ['requireLowercase', 'Require lowercase letters'],
            ['requireNumber', 'Require numbers'],
            ['requireSpecialCharacter', 'Require special characters'],
            ['sensitiveActionPasswordRequired', 'Require password on sensitive actions'],
          ] as Array<[keyof SecuritySettingsResponse, string]>
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 rounded-xl border border-border bg-cream px-4 py-3 text-sm dark:border-darkBorder dark:bg-darkBg">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(event) => setForm((current) => current ? { ...current, [key]: event.target.checked } : current)}
            />
            <span>{label}</span>
          </label>
        ))}
      </section>
    </div>
  );
}
