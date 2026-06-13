'use client';

import { FileDown } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsResourceTable } from '@/components/settings/settings-resource-table';

export default function SettingsExportHistoryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Export History"
        description="Review the audit trail for exported master data and finance setup reference files."
        status="partial"
      />
      <SettingsNav />
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brown dark:text-darkText">
          <FileDown className="h-4 w-4" />
          Export Batches
        </div>
        <SettingsResourceTable
          endpoint="/api/settings/export/history"
          emptyTitle="No export history found"
          emptyDescription="Exported settings batches will appear here once users start generating files."
          columns={[
            { key: 'data_type', header: 'Data Type' },
            { key: 'file_name', header: 'File Name' },
            { key: 'export_format', header: 'Format' },
            { key: 'status', header: 'Status' },
            { key: 'filters', header: 'Filters' },
            { key: 'exported_at', header: 'Exported At' },
          ]}
        />
      </section>
    </div>
  );
}
