import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  financeService,
  generateFinanceReferenceNumber,
  loadPettyCashRequestsCompatibility,
  logFinanceRouteError,
  isMissingFinanceColumn,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const data = await loadPettyCashRequestsCompatibility(ctx.organizationId, { routeName: 'finance.petty-cash' });
    return NextResponse.json(data);
  } catch (err) {
    logFinanceRouteError('finance.petty-cash', 'list', err);
    return serverError('Some petty cash data could not be loaded. Please refresh or contact support.');
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
    const basePayload = {
      organization_id: ctx.organizationId,
      request_number: requestNumber,
      branch_id: body.branchId ?? null,
      requested_by: ctx.userId,
      request_date: body.requestDate ?? new Date().toISOString().slice(0, 10),
      purpose: body.purpose,
      status: 'PENDING',
    };
    const insertAttempts = [
      { amount_requested: body.amountRequested },
      { requested_amount: body.amountRequested },
      { amount: body.amountRequested },
      { total_amount: body.amountRequested },
      { estimated_amount: body.amountRequested },
    ];

    let data: Record<string, unknown> | null = null;
    let lastError: unknown = null;

    for (const amountPayload of insertAttempts) {
      const result = await service
        .from('petty_cash_requests')
        .insert({
          ...basePayload,
          ...amountPayload,
        })
        .select()
        .single();

      if (!result.error) {
        data = result.data as Record<string, unknown>;
        lastError = null;
        break;
      }

      lastError = result.error;
      const missingColumnAttempt = Object.keys(amountPayload)[0] ?? '';
      if (!isMissingFinanceColumn(result.error, 'petty_cash_requests', missingColumnAttempt)) {
        throw result.error;
      }

      logFinanceRouteError('finance.petty-cash', `create.${missingColumnAttempt}`, result.error);
    }

    if (!data) {
      throw lastError ?? new Error('Failed to create petty cash request.');
    }

    await writeFinanceAuditLog('PETTY_CASH_REQUEST_CREATED', String(data.id), ctx.userId, { amountRequested: body.amountRequested }, 'petty_cash_request');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    logFinanceRouteError('finance.petty-cash', 'create', err);
    return serverError('Petty cash request could not be saved. Please refresh or contact support.');
  }
}
