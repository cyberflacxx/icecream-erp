import { createServiceRoleClient } from '@/lib/supabase/server';
import { REPORT_DEFINITIONS, type ReportDefinition } from '@/lib/reporting';
import { recordAuditLog, recordSecurityEvent } from '@/lib/security-server';

function reportingService() {
  return createServiceRoleClient().schema('icecream_erp');
}

function sanitizeJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

export async function ensureReportDefinitions() {
  const service = reportingService();
  try {
    await service.from('report_definitions').upsert(
      REPORT_DEFINITIONS.map((definition) => ({
        category: definition.category,
        description: definition.description,
        name: definition.name,
        report_code: definition.code,
        required_permission: definition.requiredPermission,
        route_path: definition.path,
        is_active: true,
      })),
      { onConflict: 'category,report_code' },
    );
  } catch {}
}

export async function listReportDefinitions() {
  await ensureReportDefinitions();
  const service = reportingService();
  const { data, error } = await service
    .from('report_definitions')
    .select('id, category, report_code, name, description, required_permission, route_path, is_active')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function recordReportRun(input: {
  branchId?: string | null;
  category: string;
  filters: Record<string, unknown>;
  format?: string | null;
  reportType: string;
  status: string;
  userProfileId: string;
}) {
  const service = reportingService();
  try {
    await service.from('report_run_histories').insert({
      branch_id: input.branchId ?? null,
      filters: sanitizeJson(input.filters),
      report_category: input.category,
      report_type: input.reportType,
      status: input.status,
      export_format: input.format ?? null,
      generated_at: new Date().toISOString(),
      generated_by: input.userProfileId,
      user_profile_id: input.userProfileId,
    });
  } catch {}
}

export async function recordReportExport(input: {
  branchId?: string | null;
  category: string;
  fileName: string;
  filters: Record<string, unknown>;
  format: string;
  organizationId: string;
  reportType: string;
  userProfileId: string;
}) {
  const service = reportingService();
  try {
    await service.from('report_exports').insert({
      branch_id: input.branchId ?? null,
      export_format: input.format,
      exported_at: new Date().toISOString(),
      exported_by: input.userProfileId,
      file_name: input.fileName,
      filters: sanitizeJson(input.filters),
      report_category: input.category,
      report_type: input.reportType,
      status: 'EXPORTED',
      user_profile_id: input.userProfileId,
    });
  } catch {}

  await Promise.all([
    recordAuditLog({
      organizationId: input.organizationId,
      userProfileId: input.userProfileId,
      action: 'REPORT_EXPORTED',
      entityType: 'report_export',
      entityId: `${input.category}:${input.reportType}`,
      newValues: {
        fileName: input.fileName,
        filters: input.filters,
        format: input.format,
      },
    }),
    recordSecurityEvent({
      organizationId: input.organizationId,
      userProfileId: input.userProfileId,
      eventType: 'DATA_EXPORT',
      status: 'SUCCESS',
      details: {
        category: input.category,
        format: input.format,
        reportType: input.reportType,
      },
    }),
  ]);
}

export async function listReportExportHistory(userProfileId?: string) {
  const service = reportingService();
  let query = service
    .from('report_exports')
    .select('id, report_category, report_type, export_format, exported_at, exported_by, file_name, filters, status, user_profile_id')
    .order('exported_at', { ascending: false });

  if (userProfileId) {
    query = query.eq('user_profile_id', userProfileId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function listSavedReportFilters(userProfileId: string) {
  const service = reportingService();
  const { data, error } = await service
    .from('saved_report_filters')
    .select('id, filter_name, report_category, report_type, filter_values, visibility, is_default, role_name')
    .or(`user_profile_id.eq.${userProfileId},visibility.eq.role,visibility.eq.global`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function createSavedReportFilter(input: {
  category: string;
  filterName: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
  reportType: string;
  roleName?: string | null;
  userProfileId: string;
  visibility?: string;
}) {
  const service = reportingService();
  const { data, error } = await service
    .from('saved_report_filters')
    .insert({
      filter_name: input.filterName,
      filter_values: sanitizeJson(input.filters),
      is_default: Boolean(input.isDefault),
      report_category: input.category,
      report_type: input.reportType,
      role_name: input.roleName ?? null,
      user_profile_id: input.userProfileId,
      visibility: input.visibility ?? 'private',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function updateSavedReportFilter(id: string, userProfileId: string, updates: Record<string, unknown>) {
  const service = reportingService();
  const mapped: Record<string, unknown> = {};
  if (updates.filterName !== undefined) mapped.filter_name = updates.filterName;
  if (updates.filters !== undefined) mapped.filter_values = sanitizeJson(updates.filters);
  if (updates.visibility !== undefined) mapped.visibility = updates.visibility;
  if (updates.isDefault !== undefined) mapped.is_default = updates.isDefault;
  const { data, error } = await service
    .from('saved_report_filters')
    .update(mapped)
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function deleteSavedReportFilter(id: string, userProfileId: string) {
  const service = reportingService();
  const { data: existing, error: existingError } = await service
    .from('saved_report_filters')
    .select('*')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .maybeSingle();
  if (existingError) throw existingError;

  const { error } = await service
    .from('saved_report_filters')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId);
  if (error) throw error;

  return (existing ?? null) as Record<string, unknown> | null;
}

export function flattenRows(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as Array<Record<string, unknown>>;
    }
  }

  return [] as Array<Record<string, unknown>>;
}

export function getReportLabel(definition: ReportDefinition) {
  return `${definition.name} (${definition.category})`;
}
