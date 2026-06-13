import { badRequest, canAccessBranchScope } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/api-auth';

export function branchService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export function ensureBranchScope(ctx: AuthContext, branchId: string) {
  if (!canAccessBranchScope(ctx, branchId)) {
    throw new Error('This action is outside the current branch scope.');
  }
}

export async function getActiveBranchWarehouse(branchId: string) {
  const service = branchService();
  const { data, error } = await service
    .from('warehouses')
    .select('id, branch_id, code, name')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .eq('type', 'BRANCH')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('No active branch warehouse found');
  return data;
}

export async function generateBranchReferenceNumber(table: string, prefix: string) {
  const service = branchService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeBranchAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'branch',
) {
  const service = branchService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function requireOpenShift(branchId: string, shiftType: string, shiftDate: string) {
  const service = branchService();
  const { data, error } = await service
    .from('branch_shift_closes')
    .select('id, shift_type, shift_date, status')
    .eq('branch_id', branchId)
    .eq('shift_type', shiftType)
    .eq('shift_date', `${shiftDate}T00:00:00.000Z`)
    .eq('status', 'OPEN')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('An OPEN branch shift is required before this transaction can be recorded.');
  return data;
}
