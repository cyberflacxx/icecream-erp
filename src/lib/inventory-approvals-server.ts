import { createServiceRoleClient } from '@/lib/supabase/server';

export type InventoryApprovalProcessAction = 'APPROVE' | 'REJECT';

export type InventoryApprovalProcessResult = {
  code?: string;
  currentStatus?: string;
  data?: unknown;
  message?: string;
  success: boolean;
};

function normalizeRpcResult(value: unknown): InventoryApprovalProcessResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      code: 'unexpected_result',
      message: 'Approval processing returned an unexpected result.',
      success: false,
    };
  }

  const row = value as Record<string, unknown>;
  return {
    code: row.code ? String(row.code) : undefined,
    currentStatus: row.currentStatus ? String(row.currentStatus) : undefined,
    data: row.data,
    message: row.message ? String(row.message) : undefined,
    success: row.success === true,
  };
}

export async function processInventoryApproval(input: {
  action: InventoryApprovalProcessAction;
  approvalId: string;
  comments?: string | null;
  ipAddress?: string | null;
  organizationId: string;
  userAgent?: string | null;
  userId: string;
}) {
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc('process_inventory_approval', {
    p_action: input.action,
    p_actor_user_id: input.userId,
    p_approval_id: input.approvalId,
    p_comments: input.comments ?? null,
    p_ip_address: input.ipAddress ?? null,
    p_organization_id: input.organizationId,
    p_user_agent: input.userAgent ?? null,
  });

  if (error) {
    throw new Error('Failed to process approval atomically.');
  }

  return normalizeRpcResult(data);
}
