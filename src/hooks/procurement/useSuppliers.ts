'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { type PaginatedResponse, type SupplierFilters, type SupplierRow } from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function useSuppliers(filters: SupplierFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'suppliers', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<SupplierRow>>(
        `${API_ROUTES.SUPPLIERS}${buildProcurementQuery({
          categoryId: filters.categoryId,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          search: filters.search,
          status: filters.status
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


