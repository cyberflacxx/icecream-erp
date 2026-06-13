'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type PaginatedResponse, type SupplierShortageRow } from './types';
import { buildInventoryQuery, useInventoryRequest } from './useInventoryRequest';

export function useSupplierShortages(params: {
  page?: number;
  pageSize?: number;
  supplierId?: string;
}) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useInventoryRequest();

  return useQuery({
    queryKey: ['inventory', 'supplier-shortages', userId, params],
    queryFn: () =>
      request<PaginatedResponse<SupplierShortageRow>>(
        `${API_ROUTES.INVENTORY.SUPPLIER_SHORTAGES}${buildInventoryQuery(params)}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
