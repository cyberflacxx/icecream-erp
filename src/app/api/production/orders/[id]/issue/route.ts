import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { mapProductionRpcError, postProductionIssue } from '@/lib/production-orders-server';
import { isProductionDocumentDateInFuture } from '@/lib/production';
import { authorizeProductionOrderWriteAccess } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_issue.post')) return forbidden();

  try {
    const { id } = await params;
    const authorization = await authorizeProductionOrderWriteAccess(id, ctx);
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    }
    const body = await request.json() as {
      department?: string | null;
      idempotencyKey?: string | null;
      issueDate?: string | null;
      lines?: Array<Record<string, unknown>>;
      remarks?: string | null;
      shift?: string | null;
    };
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('At least one issue line is required.');
    if (isProductionDocumentDateInFuture(body.issueDate ?? null)) {
      return badRequest('issueDate cannot be in the future.');
    }
    const result = await postProductionIssue({
      department: body.department ?? null,
      idempotencyKey: body.idempotencyKey ?? request.headers.get('idempotency-key'),
      issueDate: body.issueDate ?? null,
      lines: body.lines,
      orderId: id,
      remarks: body.remarks ?? null,
      shift: body.shift ?? null,
    }, ctx);
    return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
