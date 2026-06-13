'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchPaymentRow } from './types';
import { useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchPayments(branchId: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'payments', userId, branchId],
    queryFn: () => request<BranchPaymentRow[]>(`/api/branches/${branchId}/payments`),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId),
  });
}
