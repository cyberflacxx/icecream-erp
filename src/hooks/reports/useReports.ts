'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export const reportTypes = [
  'daily_production',
  'wastage',
  'raw_material_usage',
  'branch_sales',
  'inventory_valuation',
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

/** @deprecated token is no longer needed; use apiFetch directly */
export async function requestWithToken<T>(path: string, _token: string | null, options?: RequestInit) {
  return apiFetch<T>(path, options);
}
