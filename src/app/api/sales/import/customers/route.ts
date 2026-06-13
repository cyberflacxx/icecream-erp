import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateCustomerImportRows } from '@/lib/sales';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    if (!Array.isArray(body.rows)) return badRequest('rows are required.');
    const result = validateCustomerImportRows(body.rows);
    return NextResponse.json(result, { status: result.errors.length ? 400 : 200 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
