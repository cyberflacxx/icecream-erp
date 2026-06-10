'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/shared';

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

interface UnreadCountResponse {
  count: number;
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

      const params = new URLSearchParams({
        limit: String(limit),
        page: '1',
        pageSize: String(limit)
      });

      return apiFetch<NotificationsResponse>(`${API_ROUTES.NOTIFICATIONS}?${params.toString()}`, {
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

      return apiFetch(API_ROUTES.NOTIFICATION_READ(notificationId), {
        method: 'PATCH',
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

      return apiFetch(API_ROUTES.NOTIFICATIONS_READ_ALL, {
        method: 'PATCH',
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

export function useUnreadNotificationsCount() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['notifications-unread', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<UnreadCountResponse>(API_ROUTES.NOTIFICATIONS_UNREAD_COUNT, { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
    refetchInterval: 30_000
  });
}


