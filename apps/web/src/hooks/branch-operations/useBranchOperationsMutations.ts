'use client';

import { useBranchOperationsMutation } from './useBranchOperationsRequest';

export function useCreateBranchSale(branchId: string | undefined) {
  return useBranchOperationsMutation<unknown, Record<string, unknown>>(
    `/api/branch-operations/${branchId}/sales`,
  );
}

export function useCreateBranchExpense(branchId: string | undefined) {
  return useBranchOperationsMutation<unknown, Record<string, unknown>>(
    `/api/branch-operations/${branchId}/expenses`,
  );
}

export function useInitShiftClose(branchId: string | undefined) {
  return useBranchOperationsMutation<unknown, Record<string, unknown>>(
    `/api/branch-operations/${branchId}/shift-closes`,
  );
}

export function useSubmitShiftClose(branchId: string | undefined, shiftCloseId: string | undefined) {
  return useBranchOperationsMutation<unknown, Record<string, unknown>>(
    `/api/branch-operations/${branchId}/shift-closes/${shiftCloseId}/submit`,
  );
}

export function useApproveShiftClose(branchId: string | undefined, shiftCloseId: string | undefined) {
  return useBranchOperationsMutation<unknown, Record<string, never>>(
    `/api/branch-operations/${branchId}/shift-closes/${shiftCloseId}/approve`,
  );
}
