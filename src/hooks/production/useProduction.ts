'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface ProductionDashboardResponse {
  recentIssues: Array<{
    documentDate: string;
    documentNumber: string;
    id: string;
    postingStatus: string;
    productionOrderId: string;
    quantity: number;
    warehouseName: string | null;
  }>;
  recentOrders: Array<{
    actualCost: number;
    id: string;
    plannedCost: number;
    productionOrderNumber: string;
    productDescription: string;
    productNumber: string;
    remainingQuantity: number;
    releasedQuantity: number;
    status: string;
  }>;
  recentReceipts: Array<{
    documentDate: string;
    documentNumber: string;
    id: string;
    postingStatus: string;
    productionOrderId: string;
    quantity: number;
    warehouseName: string | null;
  }>;
  stats: {
    actualCost: number;
    closedOrders: number;
    costVariance: number;
    ordersRequiringMaterials: number;
    outstandingFinishedGoodsReceiptQuantity: number;
    outstandingMaterialQuantity: number;
    plannedCost: number;
    plannedOrders: number;
    releasedOrders: number;
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
