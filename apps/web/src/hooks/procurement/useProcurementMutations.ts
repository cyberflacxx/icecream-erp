'use client';

import { useProcurementMutation } from './useProcurementRequest';

export function useCreateSupplier() {
  return useProcurementMutation<unknown, Record<string, unknown>>('/api/suppliers');
}

export function useUpdateSupplier(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(`/api/suppliers/${id}`, 'PATCH');
}

export function useCreateRequisition() {
  return useProcurementMutation<unknown, Record<string, unknown>>('/api/procurement/requisitions');
}

export function useUpdateRequisition(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    `/api/procurement/requisitions/${id}`,
    'PATCH',
  );
}

export function useSubmitRequisition(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, never>>(
    `/api/procurement/requisitions/${id}/submit`,
  );
}

export function useApproveRequisition(id: string | undefined) {
  return useProcurementMutation<unknown, { remarks?: string }>(
    `/api/procurement/requisitions/${id}/approve`,
  );
}

export function useRejectRequisition(id: string | undefined) {
  return useProcurementMutation<unknown, { remarks?: string }>(
    `/api/procurement/requisitions/${id}/reject`,
  );
}

export function useCreatePurchaseOrder() {
  return useProcurementMutation<unknown, Record<string, unknown>>('/api/procurement/purchase-orders');
}

export function useUpdatePurchaseOrder(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    `/api/procurement/purchase-orders/${id}`,
    'PATCH',
  );
}

export function useApprovePurchaseOrder(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, never>>(
    `/api/procurement/purchase-orders/${id}/approve`,
  );
}

export function useSendPurchaseOrder(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, never>>(
    `/api/procurement/purchase-orders/${id}/send`,
  );
}

export function useCreateGRN() {
  return useProcurementMutation<unknown, Record<string, unknown>>('/api/procurement/grns');
}

export function useReceiveGRN(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    `/api/procurement/grns/${id}/receive`,
  );
}
