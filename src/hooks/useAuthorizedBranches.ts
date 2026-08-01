'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export interface AuthorizedBranchOption {
  code: string;
  defaultWarehouse?: {
    code: string;
    id: string;
    name: string;
  } | null;
  defaultWarehouseId: string | null;
  id: string;
  name: string;
  organizationId: string;
  status: string;
}

export function useAuthorizedBranches(options: { includeInactive?: boolean } = {}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['selectors', 'branches', userId, options],
    queryFn: async () => {
      const token = await getToken();
      const searchParams = new URLSearchParams({
        selector: 'true',
      });
      if (options.includeInactive) {
        searchParams.set('includeInactive', 'true');
      }

      const response = await apiFetch<{ data: AuthorizedBranchOption[] }>(`${API_ROUTES.BRANCHES}?${searchParams.toString()}`, {
        token,
      });
      return response.data ?? [];
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
