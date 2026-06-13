'use client';

import { AlertCircle } from 'lucide-react';

import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { type SettingsMasterDataRow, useSettingsCollection } from '@/hooks/settings/useSettings';

interface SettingsResourceTableProps {
  columns: Array<{ key: string; header: string }>;
  emptyDescription: string;
  emptyTitle: string;
  endpoint: string;
}

function formatValue(value: SettingsMasterDataRow[string]) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (Array.isArray(value)) return `${value.length} record(s)`;
  if (typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') return value.name;
    if ('abbreviation' in value && typeof value.abbreviation === 'string') return value.abbreviation;
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function SettingsResourceTable({
  columns,
  emptyDescription,
  emptyTitle,
  endpoint,
}: SettingsResourceTableProps) {
  const query = useSettingsCollection(endpoint);

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title={emptyTitle}
        description={query.error?.message ?? emptyDescription}
      />
    );
  }

  return (
    <DataTable
      columns={columns.map((column) => ({
        key: column.key,
        header: column.header,
        render: (row: SettingsMasterDataRow) => formatValue(row[column.key]),
      }))}
      data={query.data}
      emptyState={
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
    />
  );
}
