import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, mapNestedRow, writeFinanceAuditLog } from '@/lib/finance-server';

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
      referenceNumber?: string;
      sourceDocument?: string;
      transactionDate: string;
      transactionType: string;
    };
    if (!body.bankAccountId || !body.transactionDate || !body.transactionType || Number(body.amount) <= 0) {
      return badRequest('bankAccountId, transactionDate, transactionType, and a positive amount are required');
    }

    const { data, error } = await financeService()
      .from('bank_transactions')
      .insert({
        organization_id: ctx.organizationId,
        bank_account_id: body.bankAccountId,
        transaction_date: body.transactionDate,
        transaction_type: body.transactionType,
        amount: body.amount,
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

    await writeFinanceAuditLog('BANK_TRANSACTION_CREATED', data.id, ctx.userId, { amount: body.amount }, 'bank_transaction');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
