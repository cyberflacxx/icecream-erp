import type { AuthContext } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export type SupplierPaymentTransactionResult = {
  idempotentReplay?: boolean;
  journalId?: string;
  journalNumber?: string;
  paymentId: string;
  sourceReference?: string;
  success: boolean;
};

export async function postSupplierPaymentTransaction(
  input: Record<string, unknown>,
  ctx: AuthContext,
) {
  const service = createServiceRoleClient().schema('icecream_erp');
  const { data, error } = await service.rpc('post_supplier_payment_transaction', {
    p_actor_user_profile_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_payment_payload: input,
  });
  if (error) throw error;
  return data as SupplierPaymentTransactionResult;
}
