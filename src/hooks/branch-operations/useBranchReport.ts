'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranchReport(path: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'report', userId, path],
    queryFn: () => request<Array<Record<string, unknown>>>(path),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(path),
  });
}
