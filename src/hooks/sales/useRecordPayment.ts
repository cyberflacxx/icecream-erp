'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface RecordPaymentPayload {
  amount: number;
  bankAccountId?: string;
  cashAccountId?: string;
  customerId: string;
  invoiceId: string;
  notes?: string;
  paymentDate: string;
  paymentMethod: 'CASH' | 'BANK' | 'BANK_TRANSFER' | 'PETTY_CASH';
  referenceNumber?: string;
}

export interface RecordPaymentResponse {
  invoice?: Record<string, unknown>;
  journal?: { entryNumber: string; id: string } | null;
  linkedTransaction?: { id: string; table: string } | null;
  payment: {
    amount?: number;
    id: string;
    payment_date?: string;
    payment_method?: string;
    payment_number?: string;
    reference_number?: string | null;
  };
}

export function useRecordPayment() {
  const { getToken } = useAppAuth();
  const queryClient = useQueryClient();

  return useMutation<RecordPaymentResponse, Error, RecordPaymentPayload>({
    mutationFn: async ({ invoiceId, ...payload }: RecordPaymentPayload) => {
      const token = await getToken();
      return apiFetch<RecordPaymentResponse>(API_ROUTES.SALES.INVOICE_PAYMENT(invoiceId), {
        body: JSON.stringify(payload),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { customerId, invoiceId }) => {
      await queryClient.invalidateQueries({ queryKey: ['invoices', invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
    }
  });
}
