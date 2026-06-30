'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export const reportTypes = [
  'daily_production',
  'wastage',
  'raw_material_usage',
  'branch_sales',
  'inventory_valuation',
  'trial_balance',
  'income_statement',
  'financial_position',
  'financial_ratios',
  'low_stock',
  'expiry_alert',
  'supplier_purchase',
  'worker_productivity',
  'branch_shift_close_summary'
] as const;

export type ReportType = (typeof reportTypes)[number];

export interface ReportFilters {
  branchId?: string;
  daysAhead?: number;
  employeeId?: string;
  endDate?: string;
  itemId?: string;
  productId?: string;
  productionLine?: string;
  shift?: 'DAY' | 'NIGHT';
  startDate?: string;
  supplierId?: string;
  warehouseId?: string;
}

export interface ReportResponse {
  chart: Array<Record<string, unknown>>;
  data: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
}

export interface SavedReportFilter {
  filter_name: string;
  filter_values: Record<string, unknown>;
  id: string;
  is_default: boolean;
  report_category: string;
  report_type: string;
  role_name: string | null;
  visibility: string;
}

export interface ReportExportHistoryRow {
  export_format: string;
  exported_at: string;
  exported_by: string | null;
  file_name: string;
  filters: Record<string, unknown>;
  id: string;
  report_category: string;
  report_type: string;
  status: string;
  user_profile_id: string;
}

interface UseReportsOptions {
  enabled?: boolean;
}

type QueryValue = boolean | number | string | null | undefined;

export function buildReportQuery(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

export function useReports(reportType: ReportType, filters: ReportFilters, options?: UseReportsOptions) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['reports', reportType, userId, filters],
    queryFn: () =>
      apiFetch<ReportResponse>(
        `/api/reports${buildReportQuery({ ...filters, reportType })}`,
      ),
    enabled: (options?.enabled ?? true) && isLoaded && Boolean(isSignedIn),
  });
}

export function useDashboardMetrics() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['reports', 'dashboard-metrics', userId],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/dashboard'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useSavedReportFilters() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['reports', 'saved-filters', userId],
    queryFn: () => apiFetch<SavedReportFilter[]>('/api/reports/saved-filters'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useCreateSavedReportFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      category: string;
      filterName: string;
      filters: Record<string, unknown>;
      isDefault?: boolean;
      reportType: string;
      visibility?: string;
    }) =>
      apiFetch('/api/reports/saved-filters', {
        body: JSON.stringify(body),
        method: 'POST',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports', 'saved-filters'] });
    },
  });
}

export function useDeleteSavedReportFilter(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      apiFetch(`/api/reports/saved-filters/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports', 'saved-filters'] });
    },
  });
}

export function useReportExportHistory(scope: 'all' | 'mine' = 'mine') {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['reports', 'export-history', userId, scope],
    queryFn: () => apiFetch<ReportExportHistoryRow[]>(`/api/reports/export-history${buildReportQuery({ scope })}`),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

/** @deprecated token is no longer needed; use apiFetch directly */
export async function requestWithToken<T>(path: string, _token: string | null, options?: RequestInit) {
  return apiFetch<T>(path, options);
}
