'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchStockLedgerRow } from './types';
import { useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchStockLedger(branchId: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'stock-ledger', userId, branchId],
    queryFn: () => request<BranchStockLedgerRow[]>(`/api/branches/${branchId}/stock-ledger`),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(branchId),
  });
}
