'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

interface QueryValue {
  [key: string]: boolean | number | string | null | undefined;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface SettingsOverviewResponse {
  companyProfile: {
    address: string | null;
    currency: string;
    email: string | null;
    logoUrl: string | null;
    name: string;
    phone: string | null;
    taxNumber: string | null;
  };
  notificationSettings: Record<string, boolean>;
  numberSeries: Record<string, string>;
}

export interface SettingsUserRow {
  branch: { id: string; name: string } | null;
  email: string;
  fullName: string;
  id: string;
  workId: string;
  role: string;
  roles: Array<{ id: string; name: string }>;
  status: string;
}

export interface SettingsRoleRow {
  description: string | null;
  id: string;
  isSystemRole: boolean;
  name: string;
  permissions: Array<{ code: string; id: string; module: string }>;
  userCount: number;
}

export interface AuditLogRow {
  action: string;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  user: string;
}

function toQueryString(params: QueryValue) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

export function useSettingsOverview() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'overview', userId],
    queryFn: () => apiFetch<SettingsOverviewResponse>('/api/settings/overview'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useSettingsSummary() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'summary', userId],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/settings/summary'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useUsers(filters: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'users', userId, filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<SettingsUserRow>>(
        `/api/users${toQueryString({
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
          search: filters.search,
          status: filters.status,
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useRoles(filters: { page?: number; pageSize?: number; search?: string }) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'roles', userId, filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<SettingsRoleRow>>(
        `/api/roles${toQueryString({
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 50,
          search: filters.search,
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function usePermissions() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'permissions', userId],
    queryFn: () =>
      apiFetch<Record<string, Array<{ code: string; id: string; name: string }>>>(
        '/api/settings/permissions',
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useAuditLogs(filters: {
  action?: string;
  endDate?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  userProfileId?: string;
}) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'audit-logs', userId, filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<AuditLogRow>>(
        `/api/settings/audit-logs${toQueryString({
          action: filters.action,
          endDate: filters.endDate,
          entityType: filters.entityType,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
          startDate: filters.startDate,
          userProfileId: filters.userProfileId,
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

function useSettingsMutation<TBody>(path: string, method: 'POST' | 'PATCH' = 'PATCH') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: TBody) =>
      apiFetch(path, { body: JSON.stringify(body), method }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateSettingsOverview() {
  return useSettingsMutation('/api/settings/overview', 'PATCH');
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      firstName: string;
      lastName: string;
      email: string;
      idNumber: string;
      roleId: string;
      branchId?: string | null;
    }) =>
      apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...body, role: body.roleId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
  });
}

export function useInviteUser() {
  return useSettingsMutation('/api/settings/users/invite', 'POST');
}

export function useAssignUserRoles(userId: string) {
  return useSettingsMutation(`/api/users/${userId}`, 'PATCH');
}

export function useUpdateUserStatus(userId: string) {
  return useSettingsMutation(`/api/users/${userId}`, 'PATCH');
}

export function useCreateRole() {
  return useSettingsMutation('/api/settings/roles', 'POST');
}

export function useUpdateRole(roleId: string) {
  return useSettingsMutation(`/api/settings/roles/${roleId}`, 'PATCH');
}

export function useAssignRolePermissions(roleId: string) {
  return useSettingsMutation(`/api/settings/roles/${roleId}/permissions`, 'PATCH');
}

export { toQueryString };
