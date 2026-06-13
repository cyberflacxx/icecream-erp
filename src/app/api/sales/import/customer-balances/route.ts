import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateCustomerBalanceImportRows } from '@/lib/sales';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    if (!Array.isArray(body.rows)) return badRequest('rows are required.');
    const result = validateCustomerBalanceImportRows(body.rows);
    return NextResponse.json(result, { status: result.errors.length ? 400 : 200 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
