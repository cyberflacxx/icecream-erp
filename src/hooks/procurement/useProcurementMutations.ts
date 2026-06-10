'use client';

import { API_ROUTES } from '@/lib/shared';

import { useProcurementMutation } from './useProcurementRequest';

export function useCreateSupplier() {
  return useProcurementMutation<unknown, Record<string, unknown>>(API_ROUTES.SUPPLIERS);
}

export function useUpdateSupplier(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    API_ROUTES.SUPPLIER(id ?? ''),
    'PATCH',
  );
}

export function useCreateRequisition() {
  return useProcurementMutation<unknown, Record<string, unknown>>(API_ROUTES.PROCUREMENT.REQUISITIONS);
}

export function useUpdateRequisition(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    API_ROUTES.PROCUREMENT.REQUISITION(id ?? ''),
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
  return useProcurementMutation<unknown, Record<string, unknown>>(API_ROUTES.PROCUREMENT.PURCHASE_ORDERS);
}

export function useUpdatePurchaseOrder(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    API_ROUTES.PROCUREMENT.PURCHASE_ORDER(id ?? ''),
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
  return useProcurementMutation<unknown, Record<string, unknown>>(API_ROUTES.PROCUREMENT.GRNS);
}

export function useReceiveGRN(id: string | undefined) {
  return useProcurementMutation<unknown, Record<string, unknown>>(
    `/api/procurement/grns/${id}/receive`,
  );
}
