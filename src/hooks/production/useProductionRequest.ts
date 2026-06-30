'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

type MutationMethod = 'DELETE' | 'PATCH' | 'POST';

export function useProductionRequest() {
  const { getToken } = useAppAuth();

  return async function request<T>(path: string, options: RequestInit = {}) {
    const token = await getToken();

    return apiFetch<T>(path, {
      ...options,
      token,
    });
  };
}

export function useProductionMutation<TData, TVariables>(
  path: string | ((variables: TVariables) => string),
  method: MutationMethod = 'POST',
) {
  const queryClient = useQueryClient();
  const request = useProductionRequest();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) =>
      request<TData>(typeof path === 'function' ? path(variables) : path, {
        body: method === 'DELETE' ? undefined : JSON.stringify(variables),
        method,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production'] }),
        queryClient.invalidateQueries({ queryKey: ['production-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
      ]);
    },
  });
}
