import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createSavedReportFilter, listSavedReportFilters } from '@/lib/reporting-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  try {
    return NextResponse.json(await listSavedReportFilters(ctx.userId));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load saved filters.');
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const body = (await request.json()) as {
    category?: string;
    filterName?: string;
    filters?: Record<string, unknown>;
    isDefault?: boolean;
    reportType?: string;
    visibility?: string;
  };

  if (!body.category || !body.reportType || !body.filterName) {
    return badRequest('category, reportType, and filterName are required.');
  }

  try {
    const record = await createSavedReportFilter({
      category: body.category,
      filterName: body.filterName,
      filters: body.filters ?? {},
      isDefault: body.isDefault,
      reportType: body.reportType,
      roleName: ctx.roles[0]?.name ?? ctx.role,
      userProfileId: ctx.userId,
      visibility: body.visibility ?? 'private',
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to save filter.');
  }
}
