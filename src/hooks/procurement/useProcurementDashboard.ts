'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type ProcurementDashboardMetrics } from './types';
import { useProcurementRequest } from './useProcurementRequest';

export function useProcurementDashboard() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'dashboard', userId],
    queryFn: () => request<ProcurementDashboardMetrics>(API_ROUTES.PROCUREMENT.DASHBOARD),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
