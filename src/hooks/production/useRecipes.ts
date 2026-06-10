'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export function useRecipes(search?: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['recipes', userId, search],
    queryFn: async () => {
      const token = await getToken();
      const suffix = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiFetch(`${API_ROUTES.PRODUCTION.RECIPES}${suffix}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
