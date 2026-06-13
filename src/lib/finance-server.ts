import { createServiceRoleClient } from '@/lib/supabase/server';

export function financeService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export async function generateFinanceReferenceNumber(table: string, prefix: string) {
  const service = financeService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeFinanceAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'finance',
) {
  const service = financeService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export function mapNestedRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
