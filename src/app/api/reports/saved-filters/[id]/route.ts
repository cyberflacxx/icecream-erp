import { NextResponse } from 'next/server';

import { recordProtectedActionAudit, requireAdminDeleteKey } from '@/lib/admin-delete-server';
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
    const body = (await request.json().catch(() => ({}))) as { adminKey?: string | null };
    const adminKeyError = await requireAdminDeleteKey({
      action: 'REPORT_FILTER_DELETED',
      body,
      ctx,
      entityId: id,
      entityType: 'saved_report_filter',
      request,
    });
    if (adminKeyError) return adminKeyError;

    const deleted = await deleteSavedReportFilter(id, ctx.userId);
    await recordProtectedActionAudit({
      action: 'REPORT_FILTER_DELETED',
      entityId: id,
      entityType: 'saved_report_filter',
      oldValues: deleted,
      newValues: { deleted: true },
      ctx,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to delete saved filter.');
  }
}
