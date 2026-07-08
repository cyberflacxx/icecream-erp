'use client';

import { useState } from 'react';
import { FileDown } from 'lucide-react';

import { DataTable, EmptyState, FilterBar, LoadingState } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { useAuditLogs } from '@/hooks/settings/useSettings';
import { downloadFromUrl } from '@/lib/export';

function toQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  user: string;
  createdAt: string;
}

export default function SettingsAuditLogsPage() {
  const [filters, setFilters] = useState({
    action: '',
    endDate: '',
    entityType: '',
    page: 1,
    pageSize: 20,
    startDate: '',
    userProfileId: ''
  });
  const logsQuery = useAuditLogs(filters);
  const catFormatter = new Intl.DateTimeFormat('en-ZW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Harare',
  });

  if (logsQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Logs"
        description="Track all critical actions and export for compliance review."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              await downloadFromUrl(
                `/api/security/export/audit-logs${toQueryString(filters)}`,
                { filename: 'audit-logs.csv' },
              );
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <SettingsNav />

      <FilterBar
        filters={[
          {
            key: 'action',
            label: 'Action',
            type: 'search',
            value: filters.action
          },
          {
            key: 'entityType',
            label: 'Entity',
            type: 'search',
            value: filters.entityType
          },
          {
            key: 'startDate',
            label: 'Start Date',
            type: 'date',
            value: filters.startDate
          },
          {
            key: 'endDate',
            label: 'End Date',
            type: 'date',
            value: filters.endDate
          }
        ]}
        onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
      />

      <DataTable
        columns={[
          { key: 'createdAt', header: 'Date', render: (row: AuditLogRow) => `${catFormatter.format(new Date(row.createdAt))} CAT` },
          { key: 'user', header: 'User' },
          { key: 'action', header: 'Action' },
          { key: 'entityType', header: 'Entity' },
          { key: 'entityId', header: 'Reference' }
        ]}
        data={(logsQuery.data?.data ?? []) as AuditLogRow[]}
        pagination={logsQuery.data?.pagination}
        emptyState={
          <EmptyState
            icon={<FileDown className="h-6 w-6" />}
            title="No audit logs found"
            description="No records match the current filter set."
          />
        }
      />
    </div>
  );
}


