'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchShiftRow } from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchShifts(branchId: string | undefined, filters: { status?: string } = {}) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'shifts', userId, branchId, filters],
    queryFn: () =>
      request<BranchShiftRow[]>(
        `/api/branches/${branchId}/shifts${buildBranchOperationsQuery({
          status: filters.status,
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId),
  });
}
