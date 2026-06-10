'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchExpenseRow, type PaginatedResponse } from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchExpenses(
  branchId: string | undefined,
  filters: {
    endDate?: string;
    page?: number;
    pageSize?: number;
    paymentMethod?: string;
    startDate?: string;
  },
) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'expenses', userId, branchId, filters],
    queryFn: () =>
      request<PaginatedResponse<BranchExpenseRow>>(
        `/api/branch-operations/${branchId}/expenses${buildBranchOperationsQuery({
          endDate: filters.endDate,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          paymentMethod: filters.paymentMethod,
          startDate: filters.startDate
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId)
  });
}


