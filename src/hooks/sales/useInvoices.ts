'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface UseInvoicesParams {
  customerId?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  status?: string;
}

function toQueryString(params: UseInvoicesParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  const value = query.toString();
  return value ? `?${value}` : '';
}

export function useInvoices(params: UseInvoicesParams = {}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['invoices', userId, params],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`${API_ROUTES.SALES.INVOICES}${toQueryString(params)}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
