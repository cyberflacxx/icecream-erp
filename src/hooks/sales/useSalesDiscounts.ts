'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export function useSalesDiscounts() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['sales', 'discounts', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(API_ROUTES.SALES.DISCOUNTS, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
