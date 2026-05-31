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

function buildReportQuery(params: Record<string, QueryValue>) {
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

async function requestWithToken<T>(path: string, token: string | null, options?: RequestInit) {
  return apiFetch<T>(path, {
    ...(options ?? {}),
    token
  });
}

export function useReports(reportType: ReportType, filters: ReportFilters, options?: UseReportsOptions) {
  const { isLoaded, isSignedIn, userId, getToken } = useAppAuth();

  return useQuery({
    queryKey: ['reports', reportType, userId, filters],
    queryFn: async () => {
      const token = await getToken();

      return requestWithToken<ReportResponse>(
        `/api/reports${buildReportQuery({
          ...filters,
          reportType
        })}`,
        token,
      );
    },
    enabled: (options?.enabled ?? true) && isLoaded && Boolean(isSignedIn)
  });
}

export function useDashboardMetrics() {
  const { isLoaded, isSignedIn, userId, getToken } = useAppAuth();

  return useQuery({
    queryKey: ['reports', 'dashboard-metrics', userId],
    queryFn: async () => {
      const token = await getToken();

      return requestWithToken<Record<string, unknown>>('/api/reports/dashboard', token);
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}

export { buildReportQuery, requestWithToken };


