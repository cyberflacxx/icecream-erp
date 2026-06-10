'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { type SupplierRow } from './types';
import { useProcurementRequest } from './useProcurementRequest';

export function useSupplier(id: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier', userId, id],
    queryFn: () => request<SupplierRow>(API_ROUTES.SUPPLIER(id ?? '')),
    enabled: isLoaded && Boolean(isSignedIn) && Boolean(id)
  });
}


