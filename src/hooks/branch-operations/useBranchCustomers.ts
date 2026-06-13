'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchCustomerRow } from './types';
import { useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchCustomers(branchId: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'customers', userId, branchId],
    queryFn: () => request<BranchCustomerRow[]>(`/api/branches/${branchId}/customers`),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId),
  });
}
