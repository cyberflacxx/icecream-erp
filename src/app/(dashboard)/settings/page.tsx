'use client';

import { useEffect, useState } from 'react';
import { Bell, Building2, Hash } from 'lucide-react';

import { EmptyState, LoadingState, StatCard } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { useSettingsOverview, useSettingsSummary, useUpdateSettingsOverview } from '@/hooks/settings/useSettings';

interface SettingsFormState {
  companyProfile: {
    address: string;
    currency: string;
    email: string;
    logoUrl: string;
    name: string;
    phone: string;
    taxNumber: string;
  };
  notificationSettings: Record<string, boolean>;
  numberSeries: {
    grnPrefix: string;
    invoicePrefix: string;
    paymentPrefix: string;
    poPrefix: string;
    requisitionPrefix: string;
    salesOrderPrefix: string;
  };
}

const defaultState: SettingsFormState = {
  companyProfile: {
    address: '',
    currency: 'USD',
    email: '',
    logoUrl: '',
    name: '',
    phone: '',
    taxNumber: ''
  },
  notificationSettings: {
    expiryAlert: true,
    lowStock: true,
    paymentReceived: true,
    productionBatchReady: true,
    purchaseOrderApproved: true,
    shiftCloseSubmitted: true
  },
  numberSeries: {
    grnPrefix: 'GRN',
    invoicePrefix: 'INV',
    paymentPrefix: 'PAY',
    poPrefix: 'PO',
    requisitionPrefix: 'REQ',
    salesOrderPrefix: 'SO'
  }
};

export default function SettingsOverviewPage() {
  const overviewQuery = useSettingsOverview();
  const summaryQuery = useSettingsSummary();
  const updateOverview = useUpdateSettingsOverview();
  const [formState, setFormState] = useState<SettingsFormState>(defaultState);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!overviewQuery.data) {
      return;
    }

    const payload = overviewQuery.data as Partial<SettingsFormState>;
    setFormState({
      companyProfile: {
        ...defaultState.companyProfile,
        ...(payload.companyProfile ?? {})
      },
      notificationSettings: {
        ...defaultState.notificationSettings,
        ...(payload.notificationSettings ?? {})
      },
      numberSeries: {
        ...defaultState.numberSeries,
        ...(payload.numberSeries ?? {})
      }
    });
  }, [overviewQuery.data]);

  if (overviewQuery.isLoading || summaryQuery.isLoading) {
    return <LoadingState />;
  }

  if (overviewQuery.isError) {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="Settings unavailable"
        description={overviewQuery.error.message}
      />
    );
  }

  const summary = (summaryQuery.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage company profile, numbering rules, and system notifications."
        status="partial"
        actions={
          <Button
            onClick={async () => {
              try {
                await updateOverview.mutateAsync(formState);
                setMessage('Settings saved successfully.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Failed to save settings.');
              }
            }}
          >
            Save Settings
          </Button>
        }
      />
      <SettingsNav />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Users" value={String(summary.userCount ?? 0)} icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Roles" value={String(summary.roleCount ?? 0)} icon={<Hash className="h-5 w-5" />} color="brown" />
        <StatCard title="Unread Alerts" value={String(summary.unreadCount ?? 0)} icon={<Bell className="h-5 w-5" />} color="warning" />
        <StatCard title="Audit Entries" value={String(summary.auditCount ?? 0)} icon={<Hash className="h-5 w-5" />} color="success" />
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Company Profile</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ['name', 'Company Name'],
              ['address', 'Address'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['taxNumber', 'Tax Number'],
              ['currency', 'Currency'],
              ['logoUrl', 'Logo URL']
            ] as Array<[keyof SettingsFormState['companyProfile'], string]>
          ).map(([key, label]) => (
            <label key={key} className="space-y-2 text-sm text-muted dark:text-darkMuted">
              <span>{label}</span>
              <input
                value={formState.companyProfile[key]}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    companyProfile: {
                      ...current.companyProfile,
                      [key]: event.target.value
                    }
                  }))
                }
                className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Number Series</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ['poPrefix', 'PO Prefix'],
              ['invoicePrefix', 'Invoice Prefix'],
              ['requisitionPrefix', 'Requisition Prefix'],
              ['grnPrefix', 'GRN Prefix'],
              ['salesOrderPrefix', 'Sales Order Prefix'],
              ['paymentPrefix', 'Payment Prefix']
            ] as Array<[keyof SettingsFormState['numberSeries'], string]>
          ).map(([key, label]) => (
            <label key={key} className="space-y-2 text-sm text-muted dark:text-darkMuted">
              <span>{label}</span>
              <input
                value={formState.numberSeries[key]}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    numberSeries: {
                      ...current.numberSeries,
                      [key]: event.target.value
                    }
                  }))
                }
                className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Notification Settings</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(formState.notificationSettings).map(([key, value]) => (
            <label key={key} className="flex items-center gap-3 rounded-xl border border-border bg-cream px-4 py-3 text-sm text-brown dark:border-darkBorder dark:bg-darkBg dark:text-darkText">
              <input
                type="checkbox"
                checked={value}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    notificationSettings: {
                      ...current.notificationSettings,
                      [key]: event.target.checked
                    }
                  }))
                }
              />
              <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}</span>
            </label>
          ))}
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-brown dark:border-darkBorder dark:bg-darkCard dark:text-darkText">
          {message}
        </div>
      ) : null}
    </div>
  );
}
