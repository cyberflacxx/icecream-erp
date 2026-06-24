'use client';

import { Download, FileDown, FileUp, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsResourceTable } from '@/components/settings/settings-resource-table';

export default function SettingsImportExportPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Import and Export Center"
        description="Manage Excel-ready templates, review import outcomes, and export reference datasets for finance and operational master data."
        status="partial"
      />
      <SettingsNav />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <FileUp className="h-4 w-4" />
            Guided Imports
          </div>
          <p className="mt-2 text-sm text-muted dark:text-darkMuted">
            Templates cover units, item categories, payment methods, tax codes, and numbering rules.
          </p>
        </div>
        <div className="surface-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <FileDown className="h-4 w-4" />
            Controlled Exports
          </div>
          <p className="mt-2 text-sm text-muted dark:text-darkMuted">
            Export master data snapshots for offline review, reconciliations, and structured corrections.
          </p>
        </div>
        <div className="surface-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <Sparkles className="h-4 w-4" />
            Default Seeding
          </div>
          <p className="mt-2 text-sm text-muted dark:text-darkMuted">
            Seed core ice cream categories, flavours, chocolate types, payment methods, and starter item codes.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
          <Download className="h-4 w-4" />
          Import Templates
        </div>
        <SettingsResourceTable
          endpoint="/api/settings/import/templates"
          emptyTitle="No import templates found"
          emptyDescription="The settings import center is available once template metadata has been seeded."
          columns={[
            { key: 'template_name', header: 'Template' },
            { key: 'module_name', header: 'Module' },
            { key: 'data_type', header: 'Data Type' },
            { key: 'required_columns', header: 'Required Columns' },
          ]}
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <FileUp className="h-4 w-4" />
            Import History
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/import/history"
            emptyTitle="No import history found"
            emptyDescription="Imported files and row-level validation results will appear here."
            columns={[
              { key: 'data_type', header: 'Data Type' },
              { key: 'file_name', header: 'File' },
              { key: 'status', header: 'Status' },
              { key: 'total_rows', header: 'Rows' },
              { key: 'successful_rows', header: 'Successful' },
              { key: 'failed_rows', header: 'Failed' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
            <FileDown className="h-4 w-4" />
            Export History
          </div>
          <SettingsResourceTable
            endpoint="/api/settings/export/history"
            emptyTitle="No export history found"
            emptyDescription="Every generated settings export is logged here for audit and traceability."
            columns={[
              { key: 'data_type', header: 'Data Type' },
              { key: 'file_name', header: 'File' },
              { key: 'export_format', header: 'Format' },
              { key: 'status', header: 'Status' },
              { key: 'filters', header: 'Filters' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
