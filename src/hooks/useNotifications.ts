'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

export interface NotificationItem {
  branchId: string | null;
  channel: string;
  createdAt: string;
  dismissedAt: string | null;
  documentId: string | null;
  documentType: string | null;
  eventType: string;
  id: string;
  isRead: boolean;
  link: string;
  message: string;
  metadata: Record<string, unknown>;
  module: string;
  readAt: string | null;
  referenceId: string | null;
  referenceType: string | null;
  severity: string;
  status: string;
  title: string;
  type: string;
  warehouseId: string | null;
}

interface NotificationListResponse {
  data: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface UnreadCountResponse {
  count: number;
}

function buildNotificationSearchParams(input: {
  isRead?: boolean;
  limit?: number;
  module?: string;
  page?: number;
  pageSize?: number;
  severity?: string;
  status?: string;
  unreadOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.limit) params.set('limit', String(input.limit));
  if (input.module) params.set('module', input.module);
  if (input.page) params.set('page', String(input.page));
  if (input.pageSize) params.set('pageSize', String(input.pageSize));
  if (input.severity) params.set('severity', input.severity);
  if (input.status) params.set('status', input.status);
  if (input.unreadOnly) params.set('unreadOnly', 'true');
  if (typeof input.isRead === 'boolean') params.set('isRead', String(input.isRead));
  return params;
}

async function fetchWithToken<T>(path: string, getToken: () => Promise<string | null | undefined>) {
  const token = await getToken();
  return apiFetch<T>(path, { token });
}

export function useNotifications(limit = 10) {
  return useNotificationsList({ limit, page: 1, pageSize: limit });
}

export function useNotificationsList(filters: {
  isRead?: boolean;
  limit?: number;
  module?: string;
  page?: number;
  pageSize?: number;
  severity?: string;
  status?: string;
  unreadOnly?: boolean;
}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  const params = buildNotificationSearchParams(filters);

  return useQuery({
    queryKey: ['notifications', userId, params.toString()],
    queryFn: async () => fetchWithToken<NotificationListResponse>(`${API_ROUTES.NOTIFICATIONS}?${params.toString()}`, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
    refetchInterval: 30_000,
  });
}

export function useUnreadNotifications(limit = 10) {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  const params = buildNotificationSearchParams({ limit, page: 1, pageSize: limit, unreadOnly: true });

  return useQuery({
    queryKey: ['notifications-unread-list', userId, params.toString()],
    queryFn: async () => fetchWithToken<NotificationListResponse>(`${API_ROUTES.NOTIFICATIONS_UNREAD}?${params.toString()}`, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_READ(notificationId), { method: 'POST', token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread-list'] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_DISMISS(notificationId), { method: 'POST', token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread-list'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATIONS_READ_ALL, { method: 'POST', token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications-unread-list'] });
    },
  });
}

export function useUnreadNotificationsCount() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['notifications-unread', userId],
    queryFn: async () => fetchWithToken<UnreadCountResponse>(API_ROUTES.NOTIFICATIONS_UNREAD_COUNT, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
    refetchInterval: 30_000,
  });
}

export function useNotificationSettings() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['notification-settings', userId],
    queryFn: async () => fetchWithToken<Record<string, unknown>>(API_ROUTES.NOTIFICATIONS_SETTINGS, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useNotificationPreferences() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async () => fetchWithToken<Array<Record<string, unknown>>>(API_ROUTES.NOTIFICATION_PREFERENCES, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();
  return useMutation({
    mutationFn: async (preferences: Array<Record<string, unknown>>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_PREFERENCES, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ preferences }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });
}

export function useNotificationAlertDashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['notification-alert-dashboard', userId],
    queryFn: async () => fetchWithToken<Record<string, unknown>>(API_ROUTES.NOTIFICATION_ALERT_DASHBOARD, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
    refetchInterval: 30_000,
  });
}

export function useNotificationDeliveryLogs() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['notification-delivery-logs', userId],
    queryFn: async () => fetchWithToken<Array<Record<string, unknown>>>(API_ROUTES.NOTIFICATION_DELIVERY_LOGS, getToken),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useCreateNotificationRule() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_RULES, { method: 'POST', token, body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });
}

export function useCreateNotificationTemplate() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_TEMPLATES, { method: 'POST', token, body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });
}

export function useCreateEscalationRule() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_ESCALATION_RULES, { method: 'POST', token, body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });
}

export function useCreateReminderRule() {
  const queryClient = useQueryClient();
  const { getToken } = useAppAuth();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_REMINDER_RULES, { method: 'POST', token, body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });
}

export function useSendNotificationTest() {
  const { getToken } = useAppAuth();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const token = await getToken();
      return apiFetch(API_ROUTES.NOTIFICATION_TEST, { method: 'POST', token, body: JSON.stringify(payload) });
    },
  });
}
