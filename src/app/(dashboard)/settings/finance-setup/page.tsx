'use client';

import { CreditCard, Hash, Percent, Settings2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsResourceTable } from '@/components/settings/settings-resource-table';

export default function SettingsFinanceSetupPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance Setup"
        description="Review numbering rules, tax codes, payment methods, and core system settings used by journals, budgeting, receivables, and payables."
        status="partial"
      />
      <SettingsNav />

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Hash className="h-4 w-4" />
            Number Sequences
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/number-sequences"
            emptyTitle="No number sequences found"
            emptyDescription="Create document prefixes for purchase, production, sales, and finance transactions."
            columns={[
              { key: 'series_type', header: 'Series Type' },
              { key: 'prefix', header: 'Prefix' },
              { key: 'last_number', header: 'Last Number' },
              { key: 'padding', header: 'Padding' },
              { key: 'reset_frequency', header: 'Reset' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Percent className="h-4 w-4" />
            Tax Codes
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/tax-codes"
            emptyTitle="No tax codes found"
            emptyDescription="Tax codes are required for invoice journals, purchase journals, and statutory reporting."
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Name' },
              { key: 'rate', header: 'Rate' },
              { key: 'applies_to_sales', header: 'Sales' },
              { key: 'applies_to_purchase', header: 'Purchases' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/payment-methods"
            emptyTitle="No payment methods found"
            emptyDescription="Set up accepted tender types for branches, receipting, petty cash, and bank collections."
            columns={[
              { key: 'code', header: 'Code' },
              { key: 'name', header: 'Method' },
              { key: 'description', header: 'Description' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Settings2 className="h-4 w-4" />
            System Settings
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/system"
            emptyTitle="No system settings found"
            emptyDescription="Enable or adjust control flags for import, export, stock validation, and module behavior."
            columns={[
              { key: 'module_name', header: 'Module' },
              { key: 'setting_key', header: 'Setting Key' },
              { key: 'setting_value', header: 'Value' },
              { key: 'description', header: 'Description' },
              { key: 'is_active', header: 'Active' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
