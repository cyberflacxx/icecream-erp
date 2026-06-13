'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export function useSalesPayments() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['sales', 'payments', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(API_ROUTES.SALES.PAYMENTS, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
