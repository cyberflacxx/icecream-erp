'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';

type MaintenanceBreakdownRow = {
  breakdown_date?: string | null;
  description?: string | null;
  downtime_hours?: number | null;
  id: string;
  machine_id?: string | null;
  machines?: {
    code?: string | null;
    name?: string | null;
  } | null;
  repair_cost?: number | null;
  resolved_at?: string | null;
  severity?: string | null;
  status?: string | null;
};

type MaintenanceBreakdownResponse = {
  data: MaintenanceBreakdownRow[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString();
}

function formatCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export default function MaintenanceBreakdownsPage() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  const query = useQuery<MaintenanceBreakdownResponse>({
    queryKey: ['maintenance', 'breakdowns', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<MaintenanceBreakdownResponse>('/api/maintenance/breakdowns', { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });

  if (!isLoaded || (isSignedIn && query.isPending && !query.data)) return <LoadingState />;
  if (!isSignedIn) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title="Sign in required"
        description="Sign in to view maintenance breakdown records."
      />
    );
  }
  if (query.isError) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title="Breakdown records unavailable"
        description={query.error?.message ?? 'Failed to load maintenance breakdown records.'}
      />
    );
  }

  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Machine Breakdowns"
        description="Track equipment failures, repair progress, downtime, and repair cost without crashing on missing maintenance tables."
        status="partial"
      />
      <DataTable
        columns={[
          {
            key: 'machine',
            header: 'Machine',
            render: (row) => String((row.machines as { name?: string | null } | null)?.name ?? row.machine_id ?? 'Unknown machine'),
          },
          { key: 'description', header: 'Issue' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={String(row.status ?? 'OPEN')} />,
          },
          {
            key: 'breakdown_date',
            header: 'Reported Date',
            render: (row) => formatDate(String(row.breakdown_date ?? '')),
          },
          {
            key: 'resolved_at',
            header: 'Resolved Date',
            render: (row) => formatDate(String(row.resolved_at ?? '')),
          },
          {
            key: 'repair_cost',
            header: 'Cost',
            render: (row) => formatCurrency(Number(row.repair_cost ?? 0)),
          },
        ]}
        data={rows}
        emptyState={
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="No breakdowns recorded"
            description="Breakdown records will appear here when maintenance incidents are logged."
          />
        }
      />
    </div>
  );
}
