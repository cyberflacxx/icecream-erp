'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export function useCreateCustomer() {
  const { getToken } = useAppAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.SALES.CUSTOMERS, {
        body: JSON.stringify(payload),
        method: 'POST',
        token
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}
