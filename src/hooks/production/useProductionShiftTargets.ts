'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export function useProductionShiftTargets() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'shift-targets', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.SHIFT_TARGETS, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
