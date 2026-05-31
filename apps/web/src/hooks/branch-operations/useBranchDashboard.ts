'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchDashboard } from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchDashboard(branchId: string | undefined, date?: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'branch-dashboard', userId, branchId, date],
    queryFn: () =>
      request<BranchDashboard>(
        `/api/branches/${branchId}/dashboard${buildBranchOperationsQuery({
          date
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId)
  });
}


