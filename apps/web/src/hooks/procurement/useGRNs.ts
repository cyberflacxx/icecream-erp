'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type GRNFilters, type GRNRow, type PaginatedResponse } from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function useGRNs(filters: GRNFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'grns', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<GRNRow>>(
        `/api/procurement/grns${buildProcurementQuery({
          endDate: filters.endDate,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          purchaseOrderId: filters.purchaseOrderId,
          startDate: filters.startDate,
          status: filters.status
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


