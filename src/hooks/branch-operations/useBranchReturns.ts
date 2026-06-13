'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchReturnRow } from './types';
import { useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchReturns(branchId: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'returns', userId, branchId],
    queryFn: () => request<BranchReturnRow[]>(`/api/branches/${branchId}/returns`),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId),
  });
}
