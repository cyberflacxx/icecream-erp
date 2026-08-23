import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';
import { resolveFinancePostingAccount } from '@/lib/finance-foundation-server';
import { createLinkedFinanceTransaction, financeErrorMessage, postFinanceDocument } from '@/lib/finance-server';

function normalizeBranchPaymentMethod(value: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'CARD' || normalized === 'ECOCASH' || normalized === 'BANK_TRANSFER') {
    return 'BANK';
  }
  return normalized;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();
  const { id } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_payments')
      .select('id, payment_date, payment_method, amount_paid, reference_number, branch_sale_id, branch_customer_id, status')
      .eq('branch_id', id)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();
  const { id } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as {
      amountPaid: number;
      bankAccountId?: string;
      branchCustomerId?: string;
      branchSaleId?: string;
      cashAccountId?: string;
      paymentDate?: string;
      paymentMethod: string;
      referenceNumber?: string;
      shiftCloseId?: string;
    };
    if (!body.amountPaid || !body.paymentMethod) return badRequest('amountPaid and paymentMethod are required');
    const normalizedPaymentMethod = normalizeBranchPaymentMethod(body.paymentMethod);
    if (normalizedPaymentMethod === 'BANK' && !String(body.bankAccountId ?? '').trim()) {
      return badRequest('bankAccountId is required for bank branch payments');
    }
    if ((normalizedPaymentMethod === 'CASH' || normalizedPaymentMethod === 'PETTY_CASH') && !String(body.cashAccountId ?? '').trim()) {
      return badRequest('cashAccountId is required for cash branch payments');
    }

    const { data, error } = await service
      .from('branch_payments')
      .insert({
        branch_id: id,
        shift_close_id: body.shiftCloseId ?? null,
        branch_sale_id: body.branchSaleId ?? null,
        branch_customer_id: body.branchCustomerId ?? null,
        payment_date: body.paymentDate ?? new Date().toISOString().slice(0, 10),
        payment_method: normalizedPaymentMethod,
        amount_paid: body.amountPaid,
        reference_number: body.referenceNumber ?? null,
        received_by: ctx.userId,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        organization_id: ctx.organizationId,
        status: 'POSTED',
      })
      .select()
      .single();
    if (error) throw error;

    if (body.branchCustomerId) {
      const { data: customer } = await service.from('branch_customers').select('current_balance').eq('id', body.branchCustomerId).maybeSingle();
      if (customer) {
        await service.from('branch_customers').update({
          current_balance: Math.max(0, Number(customer.current_balance ?? 0) - Number(body.amountPaid)),
          updated_at: new Date().toISOString(),
        }).eq('id', body.branchCustomerId);
      }
    }

    let journal: Awaited<ReturnType<typeof postFinanceDocument>> | null = null;
    let linkedTransaction: Awaited<ReturnType<typeof createLinkedFinanceTransaction>> | null = null;
    try {
      const tenderAccount =
        normalizedPaymentMethod === 'BANK'
          ? await resolveFinancePostingAccount(ctx.organizationId, 'BANK_ACCOUNT', { fallbackAccountCode: '1007' })
          : normalizedPaymentMethod === 'PETTY_CASH'
            ? await resolveFinancePostingAccount(ctx.organizationId, 'PETTY_CASH_ACCOUNT', { fallbackAccountCode: '1002' })
            : await resolveFinancePostingAccount(ctx.organizationId, 'CASH_ACCOUNT', { fallbackAccountCode: '1000' });
      const receivableAccount = await resolveFinancePostingAccount(
        ctx.organizationId,
        'ACCOUNTS_RECEIVABLE',
        { fallbackAccountCode: '1017' },
      );

      journal = await postFinanceDocument({
        branchId: id,
        createdBy: ctx.userId,
        description: `Branch payment ${String(data.id)}`,
        journalDate: body.paymentDate ?? new Date().toISOString().slice(0, 10),
        lines: [
          {
            accountId: tenderAccount.id,
            branchId: id,
            creditAmount: 0,
            debitAmount: Number(body.amountPaid),
            description: 'Branch receipt',
          },
          {
            accountId: receivableAccount.id,
            branchId: id,
            creditAmount: Number(body.amountPaid),
            debitAmount: 0,
            description: 'Reduce branch receivable',
          },
        ],
        organizationId: ctx.organizationId,
        sourceDocumentId: String(data.id),
        sourceDocumentType: 'branch_payment',
        sourceModule: 'branches',
      });

      linkedTransaction = await createLinkedFinanceTransaction({
        amount: Number(body.amountPaid),
        createdBy: ctx.userId,
        description: `Branch payment ${String(data.id)}`,
        direction: 'IN',
        organizationId: ctx.organizationId,
        paymentMethod: normalizedPaymentMethod === 'BANK' ? 'BANK' : normalizedPaymentMethod === 'PETTY_CASH' ? 'PETTY_CASH' : 'CASH',
        selectedAccountId: normalizedPaymentMethod === 'BANK' ? body.bankAccountId ?? null : body.cashAccountId ?? null,
        referenceNumber: body.referenceNumber ?? null,
        sourceDocument: journal.sourceReference,
        transactionDate: body.paymentDate ?? new Date().toISOString().slice(0, 10),
      });
    } catch (postingError) {
      return serverError(financeErrorMessage(postingError) || 'Failed to post branch payment to finance.');
    }

    await writeBranchAuditLog('BRANCH_PAYMENT_CREATED', data.id, ctx.userId, {
      amountPaid: body.amountPaid,
      branchId: id,
      journalId: journal?.id ?? null,
      linkedTransactionId: linkedTransaction?.id ?? null,
      paymentMethod: normalizedPaymentMethod,
    }, 'branch_payment');
    return NextResponse.json({ ...data, journal, linkedTransaction }, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
