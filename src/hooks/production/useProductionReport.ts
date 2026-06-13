'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

export function useProductionReport(url: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'report', url, userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(url, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(url),
  });
}
