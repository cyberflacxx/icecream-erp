'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchSaleRow, type BranchSalesFilters, type PaginatedResponse } from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchSales(branchId: string | undefined, filters: BranchSalesFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'sales', userId, branchId, filters],
    queryFn: () =>
      request<PaginatedResponse<BranchSaleRow>>(
        `/api/branch-operations/${branchId}/sales${buildBranchOperationsQuery({
          endDate: filters.endDate,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          paymentMethod: filters.paymentMethod,
          shift: filters.shift,
          startDate: filters.startDate
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId)
  });
}


