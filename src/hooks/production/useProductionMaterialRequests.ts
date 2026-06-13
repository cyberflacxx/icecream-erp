'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export function useProductionMaterialRequests() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'material-requests', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.MATERIAL_REQUESTS, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
