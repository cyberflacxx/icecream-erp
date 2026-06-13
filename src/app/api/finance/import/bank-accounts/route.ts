import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateBankAccountImportRows } from '@/lib/finance';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();
  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    return NextResponse.json(validateBankAccountImportRows(body.rows ?? []));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
