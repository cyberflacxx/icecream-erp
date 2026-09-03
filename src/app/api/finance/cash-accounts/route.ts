import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { ensureFinanceAccountCanBePosted } from '@/lib/finance-foundation-server';
import {
  financeService,
  loadCashAccountsCompatibility,
  logFinanceRouteError,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();

  if (!ctx) {
    return unauthorized();
  }

  // Cash accounts are required by both Finance and Procurement payment flows.
  // Procurement users must be able to read active cash accounts without being
  // granted unrestricted Finance access.
  if (
    !can(
      ctx,
      'finance.read',
      'procurement.read',
      'procurement.write',
      'procurement.payment.post',
    )
  ) {
    return forbidden();
  }

  const service = financeService();
  const { searchParams } = new URL(request.url);

  const activeOnly = searchParams.get('activeOnly') === 'true';
  const branchId = searchParams.get('branchId');

  try {
    const data = await loadCashAccountsCompatibility(ctx.organizationId, {
      activeOnly,
      branchId: branchId ?? undefined,
      routeName: 'finance.cash-accounts',
    });

    return NextResponse.json(data);
  } catch (err) {
    logFinanceRouteError('finance.cash-accounts', 'list', err);

    return serverError(
      'Cash accounts could not be loaded. Please refresh or contact support.',
    );
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();

  if (!ctx) {
    return unauthorized();
  }

  // Only Finance-authorized users may create cash accounts.
  if (!can(ctx, 'finance.write')) {
    return forbidden();
  }

  try {
    const body = (await request.json()) as {
      accountId: string;
      accountName: string;
      branchId?: string | null;
      currencyCode: string;
      isActive?: boolean;
      openingBalance?: number;
    };

    if (!body.accountId || !body.accountName || !body.currencyCode) {
      return badRequest(
        'accountId, accountName, and currencyCode are required',
      );
    }

    await ensureFinanceAccountCanBePosted(
      ctx.organizationId,
      body.accountId,
    );

    const service = financeService();
    const openingBalance = Number(body.openingBalance ?? 0);

    if (!Number.isFinite(openingBalance)) {
      return badRequest('openingBalance must be a valid number');
    }

    const { data, error } = await service
      .from('cash_accounts')
      .insert({
        account_name: body.accountName.trim(),
        account_id: body.accountId,
        branch_id: body.branchId || null,
        created_by: ctx.userId,
        current_balance: openingBalance,
        currency_code: body.currencyCode.trim().toUpperCase(),
        is_active: body.isActive ?? true,
        opening_balance: openingBalance,
        organization_id: ctx.organizationId,
        updated_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    await writeFinanceAuditLog(
      'CASH_ACCOUNT_CREATED',
      data.id,
      ctx.userId,
      {
        accountId: body.accountId,
        accountName: body.accountName,
      },
      'cash_account',
    );

    const cashAccounts = await loadCashAccountsCompatibility(
      ctx.organizationId,
      {
        routeName: 'finance.cash-accounts',
      },
    );

    return NextResponse.json(
      cashAccounts.find((row) => row.id === String(data.id)) ?? data,
      { status: 201 },
    );
  } catch (err) {
    return serverError(
      err instanceof Error ? err.message : 'Internal server error',
    );
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();

  if (!ctx) {
    return unauthorized();
  }

  // Only Finance-authorized users may modify cash-account configuration.
  if (!can(ctx, 'finance.write')) {
    return forbidden();
  }

  try {
    const body = (await request.json()) as {
      accountName?: string;
      branchId?: string | null;
      currencyCode?: string;
      id: string;
      isActive?: boolean;
    };

    if (!body.id) {
      return badRequest('id is required');
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };

    if (body.accountName !== undefined) {
      payload.account_name = String(body.accountName).trim();
    }

    if (body.branchId !== undefined) {
      payload.branch_id = body.branchId || null;
    }

    if (body.currencyCode !== undefined) {
      payload.currency_code = String(body.currencyCode)
        .trim()
        .toUpperCase();
    }

    if (body.isActive !== undefined) {
      payload.is_active = body.isActive;
    }

    const result = await financeService()
      .from('cash_accounts')
      .update(payload)
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.id)
      .select('id')
      .single();

    if (result.error) {
      throw result.error;
    }

    await writeFinanceAuditLog(
      'CASH_ACCOUNT_UPDATED',
      body.id,
      ctx.userId,
      payload,
      'cash_account',
    );

    const cashAccounts = await loadCashAccountsCompatibility(
      ctx.organizationId,
      {
        routeName: 'finance.cash-accounts',
      },
    );

    return NextResponse.json(
      cashAccounts.find((row) => row.id === body.id) ?? {
        id: body.id,
        ...payload,
      },
    );
  } catch (err) {
    return serverError(
      err instanceof Error ? err.message : 'Internal server error',
    );
  }
}
