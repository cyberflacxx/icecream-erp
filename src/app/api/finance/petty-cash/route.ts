import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, generateFinanceReferenceNumber, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('petty_cash_requests')
      .select('id, request_number, branch_id, request_date, amount_requested, purpose, status, approved_by, approved_at, disbursed_at')
      .order('request_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const service = financeService();
    const body = await request.json() as {
      amountRequested: number;
      branchId?: string;
      purpose: string;
      requestDate?: string;
    };
    if (!body.amountRequested || !body.purpose) return badRequest('amountRequested and purpose are required');

    const requestNumber = await generateFinanceReferenceNumber('petty_cash_requests', 'PCR');
    const { data, error } = await service
      .from('petty_cash_requests')
      .insert({
        request_number: requestNumber,
        branch_id: body.branchId ?? null,
        requested_by: ctx.userId,
        request_date: body.requestDate ?? new Date().toISOString().slice(0, 10),
        amount_requested: body.amountRequested,
        purpose: body.purpose,
        status: 'PENDING',
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('PETTY_CASH_REQUEST_CREATED', data.id, ctx.userId, { amountRequested: body.amountRequested }, 'petty_cash_request');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
