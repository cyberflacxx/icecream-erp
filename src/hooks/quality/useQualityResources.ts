'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

function useQualityQuery<T>(key: string, path: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['quality', key, userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<T>(path, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useQualityDashboard() {
  return useQualityQuery<{ stats: Record<string, unknown> }>('dashboard', '/api/quality/dashboard');
}

export function useQualityInspections() {
  return useQualityQuery<Array<Record<string, unknown>>>('inspections', '/api/quality/inspections');
}

export function useQualityReturns() {
  return useQualityQuery<Array<Record<string, unknown>>>('returns', '/api/quality/returns');
}

export function useDamagedGoods() {
  return useQualityQuery<Array<Record<string, unknown>>>('damaged-goods', '/api/quality/damaged-goods');
}

export function useExpiredGoods() {
  return useQualityQuery<Array<Record<string, unknown>>>('expired-goods', '/api/quality/expired-goods');
}

export function useMarketReports() {
  return useQualityQuery<Array<Record<string, unknown>>>('market-reports', '/api/quality/market-reports');
}

export function useQualityReport(path: string) {
  return useQualityQuery<Array<Record<string, unknown>> | Record<string, unknown>>(`report:${path}`, path);
}
