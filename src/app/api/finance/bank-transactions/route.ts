import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureFinanceAccountCanBePosted } from '@/lib/finance-foundation-server';
import {
  financeService,
  mapNestedRow,
  postFinanceDocument,
  syncBankAccountCurrentBalance,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

function getBalanceDirection(transactionType: string) {
  const type = transactionType.toUpperCase();
  return type.includes('OUT') || type.includes('WITHDRAW') || type.includes('PAYMENT') || type.includes('EXPENSE')
    ? -1
    : 1;
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('bank_transactions')
      .select('id, bank_account_id, transaction_date, transaction_type, amount, reference_number, description, source_document, status, bank_accounts(account_name, bank_name)')
      .eq('organization_id', ctx.organizationId)
      .order('transaction_date', { ascending: false });
    if (error) throw error;

    return NextResponse.json((data ?? []).map((row) => {
      const bankAccount = mapNestedRow(row.bank_accounts as Record<string, unknown> | Array<Record<string, unknown>> | null);
      return {
        amount: row.amount,
        bankAccountId: row.bank_account_id,
        bankName: bankAccount?.bank_name ?? null,
        description: row.description,
        id: row.id,
        referenceNumber: row.reference_number,
        sourceDocument: row.source_document,
        status: row.status,
        transactionDate: row.transaction_date,
        transactionType: row.transaction_type,
      };
    }));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      amount: number;
      bankAccountId: string;
      description?: string;
      offsetAccountId?: string;
      referenceNumber?: string;
      sourceDocument?: string;
      transactionDate: string;
      transactionType: string;
    };
    if (!body.bankAccountId || !body.transactionDate || !body.transactionType || Number(body.amount) <= 0 || !body.offsetAccountId) {
      return badRequest('bankAccountId, offsetAccountId, transactionDate, transactionType, and a positive amount are required');
    }

    const service = financeService();
    const amount = Number(body.amount);
    const { data: bankAccount, error: accountError } = await service
      .from('bank_accounts')
      .select('id, account_id, current_balance')
      .eq('id', body.bankAccountId)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!bankAccount) return badRequest('Bank account was not found');
    if (!bankAccount.account_id) return badRequest('Bank account is missing its linked ledger account.');
    await ensureFinanceAccountCanBePosted(ctx.organizationId, String(body.offsetAccountId));

    const { data, error } = await service
      .from('bank_transactions')
      .insert({
        organization_id: ctx.organizationId,
        bank_account_id: body.bankAccountId,
        transaction_date: body.transactionDate,
        transaction_type: body.transactionType,
        amount,
        reference_number: body.referenceNumber ?? null,
        description: body.description ?? null,
        source_document: body.sourceDocument ?? null,
        status: 'POSTED',
        created_by: ctx.userId,
        posted_by: ctx.userId,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    const increase = getBalanceDirection(body.transactionType) >= 0;
    const journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: body.description?.trim() || `Bank ${increase ? 'receipt' : 'payment'}`,
      journalDate: body.transactionDate,
      lines: increase
        ? [
            {
              accountId: String(bankAccount.account_id),
              creditAmount: 0,
              debitAmount: amount,
              description: body.description?.trim() || 'Bank receipt',
            },
            {
              accountId: String(body.offsetAccountId),
              creditAmount: amount,
              debitAmount: 0,
              description: body.description?.trim() || 'Offset account',
            },
          ]
        : [
            {
              accountId: String(body.offsetAccountId),
              creditAmount: 0,
              debitAmount: amount,
              description: body.description?.trim() || 'Offset account',
            },
            {
              accountId: String(bankAccount.account_id),
              creditAmount: amount,
              debitAmount: 0,
              description: body.description?.trim() || 'Bank payment',
            },
          ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(data.id),
      sourceDocumentType: 'bank_transaction',
      sourceModule: 'finance',
    });
    const nextBalance = await syncBankAccountCurrentBalance(body.bankAccountId);

    await writeFinanceAuditLog('BANK_TRANSACTION_CREATED', data.id, ctx.userId, { amount, journalId: journal.id, nextBalance }, 'bank_transaction');
    return NextResponse.json({ ...data, journal, nextBalance }, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
