'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type SupplierPaymentRow } from './types';
import { useProcurementRequest } from './useProcurementRequest';

export function useSupplierPayments() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-payments', userId],
    queryFn: () => request<SupplierPaymentRow[]>(API_ROUTES.PROCUREMENT.SUPPLIER_PAYMENTS),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
