'use client';

import { AlertCircle, History } from 'lucide-react';

import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { useReportExportHistory } from '@/hooks/reports/useReports';
import { formatCatDateTime } from '@/lib/date-time';

export default function ReportExportHistoryPage() {
  const query = useReportExportHistory('mine');

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Export history unavailable"
        description={query.error.message}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Report Export History"
        description="Review exported reports, timestamps, formats, and generated files."
      />
      <DataTable
        columns={[
          { key: 'report_category', header: 'Category' },
          { key: 'report_type', header: 'Report' },
          { key: 'export_format', header: 'Format' },
          { key: 'file_name', header: 'File Name' },
          { key: 'status', header: 'Status' },
          {
            key: 'exported_at',
            header: 'Exported At',
            render: (row: Record<string, unknown>) =>
              row.exported_at ? formatCatDateTime(String(row.exported_at)) : 'N/A',
          },
        ]}
        data={(query.data ?? []) as unknown as Array<Record<string, unknown>>}
        emptyState={
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No export history"
            description="Exported reports will appear here after download."
          />
        }
      />
    </div>
  );
}
