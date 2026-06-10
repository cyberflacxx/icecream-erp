'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

type QueryValue = boolean | number | string | null | undefined;

export function buildProcurementQuery(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

export function useProcurementRequest() {
  const { getToken } = useAppAuth();

  return async function request<T>(path: string, options: RequestInit = {}) {
    const token = await getToken();

    return apiFetch<T>(path, {
      ...options,
      token
    });
  };
}

export function useProcurementMutation<TData, TVariables>(
  path: string,
  method: 'PATCH' | 'POST' | 'DELETE' = 'POST',
) {
  const queryClient = useQueryClient();
  const request = useProcurementRequest();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (payload) =>
      request<TData>(path, {
        method,
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['procurement']
      });
    }
  });
}


