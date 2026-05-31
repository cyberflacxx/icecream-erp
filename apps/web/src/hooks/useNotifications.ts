'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface NotificationItem {
  createdAt: string;
  id: string;
  isRead: boolean;
  link: string;
  message: string;
  referenceId: string | null;
  referenceType: string | null;
  title: string;
  type: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function useNotifications(limit = 10) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['notifications', userId, limit],
    queryFn: async () => {
      const token = await getToken();

      return apiFetch<NotificationsResponse>(`/api/notifications?limit=${limit}&page=1&pageSize=${limit}`, {
        token
      });
    },
    enabled: isLoaded && Boolean(isSignedIn),
    refetchInterval: 30_000
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();

      return apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        token
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['notifications']
      });
    }
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();

      return apiFetch('/api/notifications/mark-all-read', {
        method: 'POST',
        token
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['notifications']
      });
    }
  });
}


