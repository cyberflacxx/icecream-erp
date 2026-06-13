'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';

import { type InventoryReportResponse } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useInventoryReport<T>(
  path: string,
  filters: Record<string, boolean | number | string | null | undefined> = {},
) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'report', path, userId, filters],
    queryFn: () => request<InventoryReportResponse<T>>(`${path}${buildInventoryQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
