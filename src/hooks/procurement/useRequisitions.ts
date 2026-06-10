'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type PaginatedResponse, type RequisitionFilters, type RequisitionRow } from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function useRequisitions(filters: RequisitionFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'requisitions', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<RequisitionRow>>(
        `/api/procurement/requisitions${buildProcurementQuery({
          department: filters.department,
          endDate: filters.endDate,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          startDate: filters.startDate,
          status: filters.status
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


