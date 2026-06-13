'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';

import { type ProcurementReportResponse } from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function useProcurementReport<T>(
  path: string,
  filters: Record<string, boolean | number | string | null | undefined> = {},
) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'report', path, userId, filters],
    queryFn: () => request<ProcurementReportResponse<T>>(`${path}${buildProcurementQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
