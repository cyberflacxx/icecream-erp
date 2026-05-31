'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import {
  type BranchShiftCloseDetail,
  type BranchShiftCloseFilters,
  type BranchShiftCloseRow,
  type PaginatedResponse
} from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchShiftCloses(branchId: string | undefined, filters: BranchShiftCloseFilters) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'shift-closes', userId, branchId, filters],
    queryFn: () =>
      request<PaginatedResponse<BranchShiftCloseRow>>(
        `/api/branch-operations/${branchId}/shift-closes${buildBranchOperationsQuery({
          endDate: filters.endDate,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          startDate: filters.startDate,
          status: filters.status
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId)
  });
}

export function useBranchShiftClose(branchId: string | undefined, shiftCloseId: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'shift-close', userId, branchId, shiftCloseId],
    queryFn: () => request<BranchShiftCloseDetail>(`/api/branch-operations/${branchId}/shift-closes/${shiftCloseId}`),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId) && Boolean(shiftCloseId)
  });
}


