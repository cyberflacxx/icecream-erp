'use client';

import { KeyRound } from 'lucide-react';

import { EmptyState, LoadingState } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { usePermissions } from '@/hooks/settings/useSettings';

export default function SettingsPermissionsPage() {
  const permissionsQuery = usePermissions();

  if (permissionsQuery.isLoading) {
    return <LoadingState />;
  }

  if (permissionsQuery.isError) {
    return (
      <EmptyState
        icon={<KeyRound className="h-6 w-6" />}
        title="Unable to load permissions"
        description={permissionsQuery.error.message}
      />
    );
  }

  const grouped = (permissionsQuery.data ?? {}) as Record<
    string,
    Array<{
      code: string;
      id: string;
      name: string;
    }>
  >;
  const modules = Object.keys(grouped);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Permissions"
        description="Read-only list of permission codes grouped by module."
      />
      <SettingsNav />

      <div className="grid gap-6 md:grid-cols-2">
        {modules.map((moduleName) => (
          <section key={moduleName} className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
            <h3 className="text-lg font-semibold text-brown dark:text-darkText">{moduleName}</h3>
            <ul className="mt-4 space-y-2">
              {grouped[moduleName]?.map((permission) => (
                <li
                  key={permission.id}
                  className="rounded-xl border border-border bg-cream px-3 py-2 text-xs font-mono text-brown dark:border-darkBorder dark:bg-darkBg dark:text-darkText"
                >
                  {permission.code}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
