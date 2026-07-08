'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';

type MaintenanceScheduleRow = {
  completed_date?: string | null;
  cost?: number | null;
  id: string;
  machine_id?: string | null;
  machines?: {
    code?: string | null;
    name?: string | null;
  } | null;
  maintenance_type?: string | null;
  notes?: string | null;
  scheduled_date?: string | null;
  status?: string | null;
};

type MaintenanceScheduleResponse = {
  data: MaintenanceScheduleRow[];
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

export default function MaintenanceSchedulesPage() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  const query = useQuery<MaintenanceScheduleResponse>({
    queryKey: ['maintenance', 'schedules', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<MaintenanceScheduleResponse>('/api/maintenance/schedules', { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });

  if (!isLoaded || (isSignedIn && query.isPending && !query.data)) return <LoadingState />;
  if (!isSignedIn) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title="Sign in required"
        description="Sign in to view maintenance schedules."
      />
    );
  }
  if (query.isError) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title="Maintenance schedules unavailable"
        description={query.error?.message ?? 'Failed to load maintenance schedules.'}
      />
    );
  }

  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Maintenance Schedules"
        description="Review preventive service plans, completion dates, status, and maintenance cost with safe empty states on legacy schemas."
        status="partial"
      />
      <DataTable
        columns={[
          {
            key: 'machine',
            header: 'Machine',
            render: (row) => String((row.machines as { name?: string | null } | null)?.name ?? row.machine_id ?? 'Unknown machine'),
          },
          { key: 'maintenance_type', header: 'Service Type' },
          {
            key: 'scheduled_date',
            header: 'Scheduled Date',
            render: (row) => formatDate(String(row.scheduled_date ?? '')),
          },
          {
            key: 'completed_date',
            header: 'Completed Date',
            render: (row) => formatDate(String(row.completed_date ?? '')),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={String(row.status ?? 'SCHEDULED')} />,
          },
          {
            key: 'cost',
            header: 'Cost',
            render: (row) => formatCurrency(Number(row.cost ?? 0)),
          },
        ]}
        data={rows}
        emptyState={
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="No maintenance schedules"
            description="Scheduled maintenance will appear here when service plans are created."
          />
        }
      />
    </div>
  );
}
