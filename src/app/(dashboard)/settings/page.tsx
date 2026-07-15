'use client';

import { useEffect, useState } from 'react';
import { Building2, FileDown, Package2, Shield, Warehouse } from 'lucide-react';

import { EmptyState, LoadingState, StatCard } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { useSettingsDashboard, useSettingsOverview, useSettingsSummary, useUpdateSettingsOverview } from '@/hooks/settings/useSettings';

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
  const dashboardQuery = useSettingsDashboard();
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

  if (overviewQuery.isLoading || summaryQuery.isLoading || dashboardQuery.isLoading) {
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
  const dashboard = (dashboardQuery.data ?? {}) as Record<string, unknown>;

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
        <StatCard title="Users" value={String(summary.userCount ?? dashboard.activeUsers ?? 0)} icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Branches" value={String(dashboard.activeBranches ?? 0)} icon={<Warehouse className="h-5 w-5" />} color="brown" />
        <StatCard title="Products" value={String(dashboard.activeProducts ?? 0)} icon={<Package2 className="h-5 w-5" />} color="success" />
        <StatCard title="Open Imports" value={String(dashboard.pendingImports ?? 0)} icon={<FileDown className="h-5 w-5" />} color="warning" />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="dashboard-blue-card p-4">
          <div className="dashboard-blue-label flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="dashboard-blue-icon h-9 w-9">
              <Shield className="h-4 w-4" />
            </span>
            Security Snapshot
          </div>
          <div className="dashboard-blue-copy mt-3 space-y-2 text-sm">
            <p>Roles configured: {String(summary.roleCount ?? 0)}</p>
            <p>Unread alerts: {String(summary.unreadCount ?? 0)}</p>
            <p>Audit entries: {String(summary.auditCount ?? 0)}</p>
          </div>
        </div>
        <div className="dashboard-blue-card p-4">
          <div className="dashboard-blue-label text-xs font-semibold uppercase tracking-[0.18em]">Master Data Coverage</div>
          <div className="dashboard-blue-copy mt-3 space-y-2 text-sm">
            <p>Warehouses active: {String(dashboard.activeWarehouses ?? 0)}</p>
            <p>Raw materials active: {String(dashboard.activeRawMaterials ?? 0)}</p>
            <p>Profile status: {String(dashboard.companyProfileStatus ?? 'PENDING')}</p>
          </div>
        </div>
        <div className="dashboard-blue-card p-4">
          <div className="dashboard-blue-label text-xs font-semibold uppercase tracking-[0.18em]">Data Movement</div>
          <div className="dashboard-blue-copy mt-3 space-y-2 text-sm">
            <p>Pending imports: {String(dashboard.pendingImports ?? 0)}</p>
            <p>Failed imports: {String(dashboard.failedImports ?? 0)}</p>
            <p>Inventory alerts: {String(summary.lowStockCount ?? 0)}</p>
          </div>
        </div>
      </section>

      <section className="surface-card-lg space-y-4">
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
                className="surface-input"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="surface-card-lg space-y-4">
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
                className="surface-input"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="surface-card-lg space-y-4">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Notification Settings</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(formState.notificationSettings).map(([key, value]) => (
            <label key={key} className="surface-checkbox-row">
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
        <div className="surface-message">
          {message}
        </div>
      ) : null}
    </div>
  );
}
