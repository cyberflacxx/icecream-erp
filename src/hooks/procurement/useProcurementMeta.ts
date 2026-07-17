'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { useProcurementRequest } from './useProcurementRequest';

export interface ProcurementMetaResponse {
  approvers: Array<{
    id: string;
    fullName: string;
    role: string | null;
  }>;
  departments: string[];
  items: Array<{
    id: string;
    code: string;
    description: string | null;
    itemType: string | null;
    label: string;
    inventory: {
      currentStock: number;
      isLowStock: boolean;
      lastReceivedDate: string | null;
      primaryWarehouseName: string | null;
      quantityOnOrder: number;
      quantityReceivedToday: number;
      reorderLevel: number;
      warehouses: Array<{
        code: string;
        id: string;
        name: string;
        quantity: number;
      }>;
    };
    name: string;
    unit_of_measure_id?: string | null;
    unitOfMeasureId: string | null;
    uomId?: string | null;
  }>;
  purchaseOrders: Array<{
    id: string;
    label?: string;
    poNumber: string;
    status: string;
    supplier: {
      id: string;
      name: string;
    } | null;
    supplierId?: string | null;
    supplierName?: string | null;
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
    code?: string | null;
    label?: string;
    name: string;
    symbol?: string | null;
  }>;
  warehouses: Array<{
    id: string;
    code: string;
    name: string;
    branchId: string | null;
    type: string | null;
    warehouseType: string | null;
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
    queryFn: async () => {
      const response = await request<
        | Array<{
            id: string;
            name: string;
          }>
        | {
            categories?: Array<{
              id: string;
              name: string;
            }>;
          }
      >(API_ROUTES.PROCUREMENT.SUPPLIER_CATEGORIES);

      return Array.isArray(response) ? response : response.categories ?? [];
    },
    enabled: isLoaded && Boolean(isSignedIn)
  });
}


