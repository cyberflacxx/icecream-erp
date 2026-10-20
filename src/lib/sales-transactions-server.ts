import type { AuthContext } from '@/lib/api-auth';
import { salesErrorMessage, salesService } from '@/lib/sales-server';

export type SalesTransactionRpcResult = {
  code?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  journalId?: string;
  journalNumber?: string;
  paymentId?: string | null;
  paymentNumber?: string | null;
  sourceReference?: string;
  success: boolean;
  [key: string]: unknown;
};

export function isSalesTransactionRpcUnavailable(error: unknown) {
  const message = salesErrorMessage(error).toLowerCase();
  return (
    message.includes('could not find the function') ||
    message.includes('function icecream_erp.post_sales_') ||
    message.includes('schema cache') ||
    message.includes('post_sales_invoice_transaction') ||
    message.includes('post_sales_payment_transaction') ||
    message.includes('post_sales_payment_transaction_v2')
  );
}

export function shouldRequireSalesTransactionRpc() {
  // Falling back to the legacy multi-request path can leave a receipt posted
  // without its corresponding cash/bank movement. Production must fail closed.
  return process.env.NODE_ENV !== 'development'
    || String(process.env.SALES_TRANSACTION_ENGINE_REQUIRED ?? '').trim().toLowerCase() === 'true';
}

export async function postSalesInvoiceTransaction(input: Record<string, unknown>, ctx: AuthContext) {
  const service = salesService();
  const { data, error } = await service.rpc('post_sales_invoice_transaction', {
    p_actor_user_profile_id: ctx.userId,
    p_invoice_payload: input,
    p_organization_id: ctx.organizationId,
  });
  if (error) throw error;
  return data as SalesTransactionRpcResult;
}

export async function postSalesPaymentTransaction(input: Record<string, unknown>, ctx: AuthContext) {
  const service = salesService();
  const { data, error } = await service.rpc('post_sales_payment_transaction_v2', {
    p_actor_user_profile_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_payment_payload: input,
  });
  if (error) throw error;
  return data as SalesTransactionRpcResult;
}

export async function voidSalesPaymentTransaction(input: { paymentId: string; reason: string }, ctx: AuthContext) {
  const service = salesService();
  const { data, error } = await service.rpc('void_sales_payment_transaction', {
    p_actor_user_profile_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_payment_id: input.paymentId,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data as SalesTransactionRpcResult;
}

export async function cancelSalesInvoiceTransaction(input: { invoiceId: string; reason: string }, ctx: AuthContext) {
  const service = salesService();
  const { data, error } = await service.rpc('cancel_sales_invoice_transaction', {
    p_actor_user_profile_id: ctx.userId,
    p_invoice_id: input.invoiceId,
    p_organization_id: ctx.organizationId,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data as SalesTransactionRpcResult;
}
