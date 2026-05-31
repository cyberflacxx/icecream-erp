'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';

import { type BranchCard, type PaginatedResponse } from './types';
import { buildBranchOperationsQuery, useBranchOperationsRequest } from './useBranchOperationsRequest';

export function useBranches(filters: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useBranchOperationsRequest();

  return useQuery({
    queryKey: ['branch-operations', 'branches', userId, filters],
    queryFn: () =>
      request<PaginatedResponse<BranchCard>>(
        `/api/branches${buildBranchOperationsQuery({
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          search: filters.search,
          status: filters.status
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


