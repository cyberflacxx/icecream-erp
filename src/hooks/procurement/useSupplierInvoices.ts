'use client';

import { useQuery } from '@tanstack/react-query';

import { API_ROUTES } from '@/lib/shared';
import { useAppAuth } from '@/hooks/useAppAuth';

import { type SupplierInvoiceRow } from './types';
import { useProcurementRequest } from './useProcurementRequest';

export function useSupplierInvoices() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-invoices', userId],
    queryFn: () => request<SupplierInvoiceRow[]>(API_ROUTES.PROCUREMENT.SUPPLIER_INVOICES),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
