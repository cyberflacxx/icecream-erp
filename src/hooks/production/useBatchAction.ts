'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

function invalidateAfterBatchMutation(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: ['production-batches'] });
  void queryClient.invalidateQueries({ queryKey: ['production-batches', id] });
  void queryClient.invalidateQueries({ queryKey: ['production'] });
  void queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
}

export function useBatchAction() {
  const { getToken } = useAppAuth();
  const queryClient = useQueryClient();

  const requestMaterials = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_REQUEST_MATERIALS(id), { method: 'POST', token });
    },
    onSuccess: async (_data, id) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const reserveMaterials = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_RESERVE(id), { method: 'POST', token });
    },
    onSuccess: async (_data, id) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const approveMaterials = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_APPROVE_MATERIALS(id), { method: 'POST', token });
    },
    onSuccess: async (_data, id) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const startBatch = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_START(id), { method: 'POST', token });
    },
    onSuccess: async (_data, id) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const submitQuality = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_SUBMIT_QUALITY(id), {
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, id) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const updateBatch = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      actualOutput?: number;
      id: string;
      labourCost?: number;
      overheadCost?: number;
      peopleOffCount?: number;
      productionLine?: string;
      wastageQuantity?: number;
      workerCount?: number;
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH(id), {
        body: JSON.stringify(payload),
        method: 'PATCH',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const recordMaterialUsage = useMutation({
    mutationFn: async ({
      id,
      materials,
      closingStocks
    }: {
      closingStocks?: Array<{
        additionalQuantity?: number;
        closingQuantity: number;
        itemId: string;
        notes?: string;
        openingQuantity?: number;
        remainingQuantity?: number;
        unitCost?: number;
        usedQuantity?: number;
        warehouseId?: string;
      }>;
      id: string;
      materials: Array<{
        id: string;
        note?: string;
        quantityActual: number;
        quantityIssued?: number;
        unitCost?: number;
      }>;
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_MATERIAL_USAGE(id), {
        body: JSON.stringify({ closingStocks, materials }),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const recordOutput = useMutation({
    mutationFn: async ({
      id,
      outputs
    }: {
      id: string;
      outputs: Array<{
        actualQuantity: number;
        id: string;
        notes?: string;
        wastageQuantity?: number;
      }>;
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_OUTPUT(id), {
        body: JSON.stringify({ outputs }),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const assignWorkers = useMutation({
    mutationFn: async ({
      id,
      workers
    }: {
      id: string;
      workers: Array<{
        attendanceStatus?: string;
        employeeId?: string;
        hoursWorked?: number;
        isOffShift?: boolean;
        outputQuantity?: number;
        remarks?: string;
        workerName?: string;
      }>;
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_ASSIGN_WORKERS(id), {
        body: JSON.stringify({ workers }),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const transferFinishedGoods = useMutation({
    mutationFn: async ({
      destinationWarehouseId,
      id,
      receivedBy,
      transferDate
    }: {
      destinationWarehouseId: string;
      id: string;
      receivedBy?: string;
      transferDate?: string;
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_TRANSFER_FINISHED_GOODS(id), {
        body: JSON.stringify({ destinationWarehouseId, receivedBy, transferDate }),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });

  const recordQualityResult = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      correctedAction?: string;
      failedQuantity?: number;
      id: string;
      notes?: string;
      passedQuantity?: number;
      rejectionReason?: string;
      status: 'PASSED' | 'FAILED' | 'CONDITIONAL_RELEASE';
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_QUALITY(id), {
        body: JSON.stringify(payload),
        method: 'PATCH',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  const closeBatch = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      actualMaterials: Array<{
        itemId: string;
        quantityActual: number;
      }>;
      id: string;
      wastageReason?: string;
    }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_CLOSE(id), {
        body: JSON.stringify(payload),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });

  const cancelBatch = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.PRODUCTION.BATCH_CANCEL(id), {
        body: JSON.stringify({ reason }),
        method: 'POST',
        token
      });
    },
    onSuccess: async (_data, { id }) => {
      invalidateAfterBatchMutation(queryClient, id);
    }
  });

  return {
    approveMaterials,
    assignWorkers,
    cancelBatch,
    closeBatch,
    recordQualityResult,
    recordMaterialUsage,
    recordOutput,
    requestMaterials,
    reserveMaterials,
    startBatch,
    submitQuality,
    transferFinishedGoods,
    updateBatch
  };
}
