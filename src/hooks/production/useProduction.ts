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
    finishedAt: string | null;
    output: number;
    productionDate: string;
    productionLine: string;
    runHours: number | null;
    shift: string;
    startedAt: string | null;
    status: string;
  }>;
  materialFlow: {
    damagedToday: number;
    consumed: number;
    issued: number;
    receivedIntoProductionToday: number;
    returnedToStoresToday: number;
    surplus: number;
  };
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
  salesPlanning: {
    bestSellingProducts: Array<{
      currentStock: number;
      itemId: string;
      productCode: string | null;
      productName: string;
      quantitySoldLast7Days: number;
      quantitySoldToday: number;
      suggestedProductionQuantity: number;
    }>;
    demandSignals: Array<{
      currentStock: number;
      productCode: string | null;
      productName: string;
      quantitySoldLast7Days: number;
      suggestedProductionQuantity: number;
    }>;
    last7DaysSalesByProduct: Array<{
      productCode: string | null;
      productName: string;
      quantity: number;
    }>;
    todaySalesByProduct: Array<{
      productCode: string | null;
      productName: string;
      quantity: number;
    }>;
  };
  shiftSummary: Array<{
    batches: number;
    date: string;
    output: number;
    shift: string;
    wastage: number;
  }>;
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
