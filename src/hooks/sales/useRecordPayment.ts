'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface RecordPaymentPayload {
  amount: number;
  customerId: string;
  invoiceId: string;
  notes?: string;
  paymentDate: string;
  paymentMethod: 'CASH' | 'ECOCASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'PETTY_CASH';
  referenceNumber?: string;
}

export function useRecordPayment() {
  const { getToken } = useAppAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, ...payload }: RecordPaymentPayload) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.SALES.INVOICE_PAYMENT(invoiceId), {
        body: JSON.stringify(payload),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { customerId, invoiceId }) => {
      await queryClient.invalidateQueries({ queryKey: ['invoices', invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
    }
  });
}
