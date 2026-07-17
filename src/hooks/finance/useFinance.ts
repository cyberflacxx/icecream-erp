'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import type { FinanceDashboardApiResponse } from '@/lib/finance';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export function useFinanceDashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['finance', 'dashboard', userId],
    queryFn: async () => {
      const token = await getToken();

      return apiFetch<FinanceDashboardApiResponse>(API_ROUTES.FINANCE.DASHBOARD, {
        token
      });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
