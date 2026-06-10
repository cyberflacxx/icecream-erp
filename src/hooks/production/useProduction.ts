'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface ProductionDashboardResponse {
  stats: {
    plannedBatches: number;
    inProgressBatches: number;
    completedToday: number;
    avgEfficiency: number;
    totalWastage: number;
  };
  charts: {
    outputLast7Days: Array<{
      day: string;
      output: number;
    }>;
    statusBreakdown: Array<{
      status: string;
      count: number;
    }>;
  };
  openBatches: Array<{
    batchNumber: string;
    output: number;
    productionDate: string;
    productionLine: string;
    shift: string;
    status: string;
  }>;
  materialsAtRisk: Array<{
    item: string;
    warehouse: string;
    available: number;
    reorderLevel: number;
    deficit: number;
  }>;
  qualityAlerts: {
    failed: number;
    pending: number;
  };
}

export function useProductionDashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'dashboard', userId],
    queryFn: async () => {
      const token = await getToken();

      return apiFetch<ProductionDashboardResponse>(API_ROUTES.PRODUCTION.DASHBOARD, {
        token
      });
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}
