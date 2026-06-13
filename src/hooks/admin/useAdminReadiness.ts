'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { API_ROUTES } from '@/lib/shared';

function useAdminQuery<T>(key: unknown[], path: string) {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
  return useQuery({
    queryKey: ['admin', userId, ...key],
    queryFn: () => apiFetch<T>(path),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}

function useAdminMutation(path: string, method: 'POST' | 'PATCH' = 'POST') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown = {}) =>
      apiFetch(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useMigrationDashboard() {
  return useAdminQuery<Record<string, unknown>>(['migration', 'dashboard'], API_ROUTES.ADMIN.MIGRATION_DASHBOARD);
}

export function useMigrationTemplates() {
  return useAdminQuery<Array<Record<string, unknown>>>(['migration', 'templates'], API_ROUTES.ADMIN.MIGRATION_TEMPLATES);
}

export function useMigrationHistory() {
  return useAdminQuery<Array<Record<string, unknown>>>(['migration', 'history'], API_ROUTES.ADMIN.MIGRATION_HISTORY);
}

export function useOpeningBalances(type: 'stock' | 'customers' | 'suppliers' | 'accounts') {
  const routeMap = {
    stock: API_ROUTES.ADMIN.OPENING_STOCK,
    customers: API_ROUTES.ADMIN.OPENING_CUSTOMERS,
    suppliers: API_ROUTES.ADMIN.OPENING_SUPPLIERS,
    accounts: API_ROUTES.ADMIN.OPENING_ACCOUNTS,
  } as const;
  return useAdminQuery<Array<Record<string, unknown>>>(['opening-balances', type], routeMap[type]);
}

export function useBackups() {
  return useAdminQuery<Record<string, unknown>>(['backups'], API_ROUTES.ADMIN.BACKUPS);
}

export function useSystemHealth() {
  return useAdminQuery<Record<string, unknown>>(['health'], API_ROUTES.ADMIN.HEALTH);
}

export function useErrorLogs() {
  return useAdminQuery<Array<Record<string, unknown>>>(['error-logs'], API_ROUTES.ADMIN.ERROR_LOGS);
}

export function useDataIntegrity() {
  return useAdminQuery<Array<Record<string, unknown>>>(['data-integrity'], API_ROUTES.ADMIN.DATA_INTEGRITY);
}

export function useDeploymentChecklist() {
  return useAdminQuery<Record<string, unknown>>(['deployment', 'checklist'], API_ROUTES.ADMIN.DEPLOYMENT_CHECKLIST);
}

export function useDeploymentReadiness() {
  return useAdminQuery<Record<string, unknown>>(['deployment', 'readiness'], API_ROUTES.ADMIN.DEPLOYMENT_READINESS);
}

export function useUploadMigrationBatch() {
  return useAdminMutation(API_ROUTES.ADMIN.MIGRATION_UPLOAD);
}

export function useValidateMigrationBatch(batchId: string) {
  return useAdminMutation(API_ROUTES.ADMIN.MIGRATION_VALIDATE(batchId));
}

export function useApproveMigrationBatch(batchId: string) {
  return useAdminMutation(API_ROUTES.ADMIN.MIGRATION_APPROVE(batchId));
}

export function useImportMigrationBatch(batchId: string) {
  return useAdminMutation(API_ROUTES.ADMIN.MIGRATION_IMPORT(batchId));
}

export function useRollbackMigrationBatch(batchId: string) {
  return useAdminMutation(API_ROUTES.ADMIN.MIGRATION_ROLLBACK(batchId));
}

export function useCreateOpeningStockBalance() {
  return useAdminMutation(API_ROUTES.ADMIN.OPENING_STOCK);
}

export function useCreateOpeningCustomerBalance() {
  return useAdminMutation(API_ROUTES.ADMIN.OPENING_CUSTOMERS);
}

export function useCreateOpeningSupplierBalance() {
  return useAdminMutation(API_ROUTES.ADMIN.OPENING_SUPPLIERS);
}

export function useCreateOpeningAccountBalance() {
  return useAdminMutation(API_ROUTES.ADMIN.OPENING_ACCOUNTS);
}

export function usePostOpeningBalances() {
  return useAdminMutation(API_ROUTES.ADMIN.OPENING_POST);
}

export function useRunBackup() {
  return useAdminMutation(API_ROUTES.ADMIN.BACKUPS_RUN);
}

export function useCreateRestoreTest() {
  return useAdminMutation(API_ROUTES.ADMIN.BACKUPS_RESTORE_TEST);
}

export function useRunSystemHealthCheck() {
  return useAdminMutation(API_ROUTES.ADMIN.HEALTH_RUN_CHECK);
}

export function useResolveErrorLog(id: string) {
  return useAdminMutation(API_ROUTES.ADMIN.ERROR_LOG_RESOLVE(id));
}

export function useRunDataIntegrityCheck() {
  return useAdminMutation(API_ROUTES.ADMIN.DATA_INTEGRITY_RUN_CHECK);
}

export function useResolveDataIntegrityIssue(id: string) {
  return useAdminMutation(API_ROUTES.ADMIN.DATA_INTEGRITY_RESOLVE(id));
}

export function useCreateDeploymentChecklistItem() {
  return useAdminMutation(API_ROUTES.ADMIN.DEPLOYMENT_CHECKLIST);
}

export function useUpdateDeploymentChecklistItem(id: string) {
  return useAdminMutation(API_ROUTES.ADMIN.DEPLOYMENT_CHECKLIST_ITEM(id), 'PATCH');
}

export function useRunDeploymentReadinessCheck() {
  return useAdminMutation(API_ROUTES.ADMIN.DEPLOYMENT_RUN_READINESS);
}

export function useRequestGoLive() {
  return useAdminMutation(API_ROUTES.ADMIN.DEPLOYMENT_REQUEST_GO_LIVE);
}

export function useApproveGoLive() {
  return useAdminMutation(API_ROUTES.ADMIN.DEPLOYMENT_APPROVE_GO_LIVE);
}
