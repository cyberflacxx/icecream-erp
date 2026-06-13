import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { deleteSavedReportFilter, updateSavedReportFilter } from '@/lib/reporting-server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const { id } = await params;
  try {
    const updated = await updateSavedReportFilter(id, ctx.userId, await request.json() as Record<string, unknown>);
    if (!updated) {
      return NextResponse.json({ error: 'Saved filter not found.' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update saved filter.');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const { id } = await params;
  try {
    await deleteSavedReportFilter(id, ctx.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to delete saved filter.');
  }
}
