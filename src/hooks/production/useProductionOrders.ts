'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export type ProductionOrderListRow = Record<string, unknown> & {
  completed_quantity: number;
  id: string;
  planned_due_date: string | null;
  planned_quantity: number;
  product_description_snapshot: string;
  product_number: string;
  production_order_number: string;
  released_quantity: number;
  remaining_quantity: number;
  status: string;
};

export type ProductionOrderDetail = {
  components: Array<Record<string, unknown>>;
  costs: Record<string, unknown> | null;
  issues: Array<Record<string, unknown>>;
  order: Record<string, unknown>;
  receipts: Array<Record<string, unknown>>;
  relationshipMap: Array<Record<string, unknown>>;
  statusHistory: Array<Record<string, unknown>>;
};

export function useProductionOrders(filters?: { search?: string; status?: string }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'orders', userId, filters?.status ?? '', filters?.search ?? ''],
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return apiFetch<ProductionOrderListRow[]>(`${API_ROUTES.PRODUCTION.ORDERS}${suffix}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useProductionOrder(id: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'order', id, userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<ProductionOrderDetail>(API_ROUTES.PRODUCTION.ORDER(id), { token });
    },
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(id),
  });
}

export function useProductionOrderProducts(search?: string) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['production', 'order-products', userId, search ?? ''],
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return apiFetch<Array<Record<string, unknown>>>(`${API_ROUTES.PRODUCTION.ORDER_PRODUCTS}${suffix}`, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
