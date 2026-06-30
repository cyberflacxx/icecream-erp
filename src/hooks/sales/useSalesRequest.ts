'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

export function useSalesRequest() {
  const { getToken } = useAppAuth();

  return async function request<T>(path: string, options: RequestInit = {}) {
    const token = await getToken();

    return apiFetch<T>(path, {
      ...options,
      token,
    });
  };
}
