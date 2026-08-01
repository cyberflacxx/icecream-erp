import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildFinanceAccountPayloads, upsertFinanceAccount } from '@/lib/finance-foundation-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const type = searchParams.get('type') ?? searchParams.get('accountType');
    const activeStatusParam = String(searchParams.get('active') ?? searchParams.get('isActive') ?? 'all').trim().toLowerCase();
    const view = String(searchParams.get('view') ?? 'list').trim().toLowerCase();

    const activeStatus =
      activeStatusParam === 'true' || activeStatusParam === 'active'
        ? 'active'
        : activeStatusParam === 'false' || activeStatusParam === 'inactive'
          ? 'inactive'
          : 'all';

    const payloads = await buildFinanceAccountPayloads(ctx.organizationId, {
      activeStatus,
      search,
      type,
    });

    if (view === 'tree') {
      return NextResponse.json({ data: payloads.tree, view: 'tree' });
    }

    return NextResponse.json({ data: payloads.list, view: 'list' });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load chart of accounts.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      accountCode?: string;
      accountName?: string;
      accountType?: string;
      allowPosting?: boolean;
      description?: string | null;
      isActive?: boolean;
      parentAccountId?: string | null;
    };

    if (!body.accountCode || !body.accountName || !body.accountType) {
      return badRequest('accountCode, accountName, and accountType are required.');
    }

    const saved = await upsertFinanceAccount(ctx, {
      accountCode: body.accountCode,
      accountName: body.accountName,
      accountType: body.accountType,
      allowPosting: body.allowPosting,
      description: body.description ?? null,
      isActive: body.isActive ?? true,
      parentAccountId: body.parentAccountId ?? null,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create account.';
    if (message.toLowerCase().includes('already exists')) {
      return badRequest(message);
    }
    return serverError(message);
  }
}
