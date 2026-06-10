'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface UseSalesOrdersParams {
  branchId?: string;
  customerId?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  status?: string;
}

function toQueryString(params: UseSalesOrdersParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  const value = query.toString();
  return value ? `?${value}` : '';
}

export function useSalesOrders(params: UseSalesOrdersParams = {}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['sales-orders', userId, params],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`${API_ROUTES.SALES.SALES_ORDERS}${toQueryString(params)}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
