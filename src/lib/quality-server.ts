import { createServiceRoleClient } from '@/lib/supabase/server';

export function qualityService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export function qualityErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingQualityTable(error: unknown, table?: string) {
  const message = qualityErrorMessage(error);
  if (table) {
    return message.includes(`Could not find the table 'icecream_erp.${table}'`) || message.toLowerCase().includes(`${table.toLowerCase()} does not exist`);
  }
  return message.includes("Could not find the table 'icecream_erp.") || message.toLowerCase().includes('does not exist');
}

export async function listQualityChecksAsInspections(input: {
  organizationId: string;
  referenceType?: string;
}) {
  let query = qualityService()
    .from('quality_checks')
    .select('id, reference_type, reference_id, check_date, status, notes, passed_quantity, failed_quantity')
    .eq('organization_id', input.organizationId)
    .order('check_date', { ascending: false });

  if (input.referenceType) {
    query = query.eq('reference_type', input.referenceType);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    inspection_number: `QC-${String(row.id).slice(0, 8).toUpperCase()}`,
    inspection_type: String(row.reference_type ?? 'GENERAL').toUpperCase(),
    reference_document: row.reference_type,
    reference_id: row.reference_id,
    inspection_date: row.check_date,
    quantity_inspected: Number(row.passed_quantity ?? 0) + Number(row.failed_quantity ?? 0),
    quantity_passed: Number(row.passed_quantity ?? 0),
    quantity_failed: Number(row.failed_quantity ?? 0),
    qc_status: row.status,
    remarks: row.notes ?? null,
    production_batch_id: row.reference_type === 'production_batch' ? row.reference_id : null,
  }));
}

export async function generateQualityReferenceNumber(table: string, prefix: string) {
  const service = qualityService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeQualityAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'quality',
) {
  const service = qualityService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}
