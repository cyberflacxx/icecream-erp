'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

function invalidateAfterBatchMutation(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: ['production-batches'] });
  void queryClient.invalidateQueries({ queryKey: ['production-batches', id] });
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
    cancelBatch,
    closeBatch,
    recordQualityResult,
    requestMaterials,
    reserveMaterials,
    startBatch,
    submitQuality
  };
}
