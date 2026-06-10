'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { useProcurementRequest } from './useProcurementRequest';

export interface ProcurementMetaResponse {
  departments: string[];
  items: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    status: string;
    supplier: {
      id: string;
      name: string;
    };
  }>;
  suppliers: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
  }>;
  units: Array<{
    id: string;
    abbreviation: string;
    name: string;
  }>;
  warehouses: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

export function useProcurementMeta() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'meta'],
    queryFn: () => request<ProcurementMetaResponse>(API_ROUTES.PROCUREMENT.META),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}

export function useSupplierCategories() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-categories'],
    queryFn: () =>
      request<
        Array<{
          id: string;
          name: string;
        }>
      >(API_ROUTES.SUPPLIERS_META),
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


