'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchStockRow, type PaginatedResponse } from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchStock(
  branchId: string | undefined,
  filters: { page?: number; pageSize?: number; search?: string },
) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'stock', userId, branchId, filters],
    queryFn: () =>
      request<PaginatedResponse<BranchStockRow>>(
        `/api/branches/${branchId}/stock${buildBranchOperationsQuery({
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          search: filters.search
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId)
  });
}


