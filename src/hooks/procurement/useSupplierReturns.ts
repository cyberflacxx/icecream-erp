'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type SupplierReturnRow } from './types';
import { useProcurementRequest } from './useProcurementRequest';

export function useSupplierReturns() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-returns', userId],
    queryFn: () => request<SupplierReturnRow[]>(API_ROUTES.PROCUREMENT.SUPPLIER_RETURNS),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
