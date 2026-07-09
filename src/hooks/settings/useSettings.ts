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

export interface AssignableRoleRow {
  description: string | null;
  id: string;
  name: string;
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

export interface SecurityEventRow {
  created_at: string;
  details: Record<string, unknown> | null;
  event_type: string;
  id: string;
  ip_address: string | null;
  status: string;
  user_profile_id: string | null;
}

export interface SecuritySessionRow {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  lastActivityAt: string;
  status: string;
  userAgent: string | null;
  userId: string;
}

export interface SecuritySettingsResponse {
  failedLoginLimit: number;
  lockoutDurationMinutes: number;
  passwordMinLength: number;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  requireUppercase: boolean;
  sensitiveActionPasswordRequired: boolean;
  sessionTimeoutMinutes: number;
}

export interface SettingsDashboardResponse {
  activeBranches: number;
  activeProducts: number;
  activeRawMaterials: number;
  activeUsers: number;
  activeWarehouses: number;
  companyProfileStatus: string;
  failedImports: number;
  pendingImports: number;
  recentExports: Array<Record<string, unknown>>;
  systemWarnings: Array<Record<string, unknown>>;
}

export interface SettingsMasterDataRow {
  [key: string]: boolean | number | string | null | Record<string, unknown> | Array<unknown> | undefined;
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
        `/api/security/users${toQueryString({
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
        `/api/security/roles${toQueryString({
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

export function useUpdateCompanyProfile() {
  return useSettingsMutation('/api/settings/company-profile', 'PATCH');
}

export function useUpdateSystemSettings() {
  return useSettingsMutation('/api/settings/system', 'PATCH');
}

export function useSeedSettingsDefaults() {
  return useSettingsMutation('/api/settings/seed-defaults', 'POST');
}

export function useGenerateDocumentNumber() {
  return useSettingsMutation<{ seriesType: string }>('/api/settings/number-sequences/generate', 'POST');
}

export function useRecordSettingsExport() {
  return useSettingsMutation<{
    dataType: string;
    fileName: string;
    filters?: Record<string, unknown>;
    format?: string;
  }>('/api/settings/export/history', 'POST');
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      adminKey: string;
      firstName: string;
      lastName: string;
      email: string;
      idNumber: string;
      roleId: string;
      branchId?: string | null;
    }) =>
      apiFetch('/api/security/users', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
  });
}

export function useDeleteUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { adminKey: string }) =>
      apiFetch(`/api/settings/users/${userId}`, {
        body: JSON.stringify(body),
        method: 'DELETE',
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
  return useSettingsMutation(`/api/settings/users/${userId}/roles`, 'PATCH');
}

export function useUpdateUserStatus(userId: string) {
  return useSettingsMutation(`/api/settings/users/${userId}/status`, 'PATCH');
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

export function useSecuritySessions() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'sessions', userId],
    queryFn: () => apiFetch<SecuritySessionRow[]>('/api/security/sessions'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useAssignableRoles() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'assignable-roles', userId],
    queryFn: async () => {
      const payload = await apiFetch<{ data: AssignableRoleRow[] }>('/api/roles');
      return payload.data ?? [];
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useSettingsDashboard() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'dashboard', userId],
    queryFn: () => apiFetch<SettingsDashboardResponse>('/api/settings/dashboard'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useSettingsCollection(path: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['settings', 'collection', path, userId],
    queryFn: () => apiFetch<SettingsMasterDataRow[]>(path),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useSecurityEvents(filters: {
  eventType?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  userProfileId?: string;
}) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'events', userId, filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<SecurityEventRow>>(
        `/api/security/events${toQueryString({
          eventType: filters.eventType,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
          status: filters.status,
          userProfileId: filters.userProfileId,
        })}`,
      ),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useSecuritySettings() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'settings', userId],
    queryFn: () => apiFetch<SecuritySettingsResponse>('/api/security/settings'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useUpdateSecuritySettings() {
  return useSettingsMutation('/api/security/settings', 'PATCH');
}

export function useApprovalRules() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'approval-rules', userId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>('/api/security/approval-rules'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function usePendingApprovals() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'approvals', userId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>('/api/security/approvals'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useBranchAssignments() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'branch-assignments', userId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>('/api/security/branch-assignments'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export function useWarehouseAssignments() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();

  return useQuery({
    queryKey: ['security', 'warehouse-assignments', userId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>('/api/security/warehouse-assignments'),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

export { toQueryString };
