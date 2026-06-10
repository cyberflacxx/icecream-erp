'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface UseBatchesParams {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  page?: number;
  productionLine?: string;
  recipeId?: string;
  shift?: 'DAY' | 'NIGHT';
  status?: string;
}

function toQueryString(params: UseBatchesParams) {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }
  if (params.limit) {
    query.set('pageSize', String(params.limit));
  }
  if (params.status) {
    query.set('status', params.status);
  }
  if (params.shift) {
    query.set('shift', params.shift);
  }
  if (params.productionLine) {
    query.set('productionLine', params.productionLine);
  }
  if (params.dateFrom) {
    query.set('startDate', params.dateFrom);
  }
  if (params.dateTo) {
    query.set('endDate', params.dateTo);
  }
  if (params.recipeId) {
    query.set('recipeId', params.recipeId);
  }

  const value = query.toString();
  return value ? `?${value}` : '';
}

export function useBatches(params: UseBatchesParams = {}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production-batches', userId, params],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`${API_ROUTES.PRODUCTION.BATCHES}${toQueryString(params)}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}

export function useBatch(id: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production-batches', userId, id],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH(id), { token });
    },
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(id)
  });
}
