import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { validateQualityTemplateImportRows } from '@/lib/quality';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  const body = await request.json() as { rows?: Array<Record<string, unknown>> };
  if (!body.rows) return badRequest('rows are required');
  return NextResponse.json(validateQualityTemplateImportRows(body.rows));
}
