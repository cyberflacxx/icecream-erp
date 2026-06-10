'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface UseCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

function toQueryString(params: UseCustomersParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);

  const value = query.toString();
  return value ? `?${value}` : '';
}

export function useCustomers(params: UseCustomersParams = {}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['customers', userId, params],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`${API_ROUTES.SALES.CUSTOMERS}${toQueryString(params)}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
