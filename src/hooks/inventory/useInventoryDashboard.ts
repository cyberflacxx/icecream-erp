'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type InventoryDashboardMetrics } from './types';
import { useInventoryRequest } from './useInventoryRequest';

export function useInventoryDashboard() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'dashboard', userId],
    queryFn: async () => {
      const response = await request<InventoryDashboardMetrics | { data?: InventoryDashboardMetrics; success?: boolean }>(
        API_ROUTES.INVENTORY.DASHBOARD,
      );

      return 'data' in response && response.data ? response.data : response as InventoryDashboardMetrics;
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
