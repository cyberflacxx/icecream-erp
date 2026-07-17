'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

import { useProcurementRequest } from './useProcurementRequest';

export interface SupplierOption {
  code: string | null;
  contactPerson: string | null;
  creditLimit: number | null;
  email: string | null;
  id: string;
  name: string;
  paymentTerms: string | null;
  phone: string | null;
  status: string | null;
}

export function formatSupplierOptionLabel(option: Pick<SupplierOption, 'code' | 'name'>) {
  return option.code ? `${option.code} - ${option.name}` : option.name;
}

export function useSupplierOptions(search?: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  const request = useProcurementRequest();

  return useQuery({
    queryKey: ['procurement', 'supplier-options', userId, search ?? ''],
    queryFn: async () => {
      const query = new URLSearchParams({
        activeOnly: 'true',
        picker: 'true',
      });

      if (search?.trim()) {
        query.set('search', search.trim());
      }

      const response = await request<{ data?: SupplierOption[] }>(
        `${API_ROUTES.PROCUREMENT.SUPPLIERS}?${query.toString()}`,
      );

      return response.data ?? [];
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
