'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

export function useWorkflowCollection<T = Array<Record<string, unknown>>>(path: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['workflows', path, userId],
    queryFn: () => apiFetch<T>(path),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useWorkflowMutation<TBody>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TBody) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workflows'] });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useWorkflowDashboard() {
  return useWorkflowCollection<Record<string, unknown>>('/api/workflows/dashboard');
}

export function useWorkflowDefinitions() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/definitions');
}

export function useWorkflowApprovals() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/approvals');
}

export function useWorkflowHistory() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/history');
}

export function useWorkflowPostingLogs() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/posting-logs');
}

export function useWorkflowCorrections() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/corrections');
}

export function useWorkflowReversals() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/reversals');
}

export function useWorkflowVoids() {
  return useWorkflowCollection<Array<Record<string, unknown>>>('/api/workflows/voids');
}
