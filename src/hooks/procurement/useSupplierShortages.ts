'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type SupplierShortageRow } from './types';
import { buildProcurementQuery, useProcurementRequest } from './useProcurementRequest';

export function useSupplierShortages(filters: { supplierId?: string } = {}) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-shortages', userId, filters],
    queryFn: () =>
      request<SupplierShortageRow[]>(
        `${API_ROUTES.PROCUREMENT.SUPPLIER_SHORTAGES}${buildProcurementQuery(filters)}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
