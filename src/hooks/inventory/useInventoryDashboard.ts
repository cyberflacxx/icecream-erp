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
    queryFn: () => request<InventoryDashboardMetrics>(API_ROUTES.INVENTORY.DASHBOARD),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
