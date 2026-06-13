import { createServiceRoleClient } from '@/lib/supabase/server';

export function qualityService() {
  return createServiceRoleClient().schema('icecream_erp');
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
