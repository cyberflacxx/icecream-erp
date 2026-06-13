'use client';

import { AlertCircle } from 'lucide-react';

import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useWorkflowCollection } from '@/hooks/workflows/useWorkflows';

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (Array.isArray(value)) return `${value.length} record(s)`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function WorkflowResourceTable({
  columns,
  endpoint,
  emptyTitle,
  emptyDescription,
}: {
  columns: Array<{ key: string; header: string }>;
  endpoint: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const query = useWorkflowCollection<Array<Record<string, unknown>>>(endpoint);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title={emptyTitle} description={query.error?.message ?? emptyDescription} />;
  }
  return (
    <DataTable
      columns={columns.map((column) => ({
        key: column.key,
        header: column.header,
        render: (row: Record<string, unknown>) => renderValue(row[column.key]),
      }))}
      data={query.data}
      emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title={emptyTitle} description={emptyDescription} />}
    />
  );
}
