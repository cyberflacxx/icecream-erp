import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { toReportCsv } from '@/lib/reporting';
import { flattenRows, recordReportExport, recordReportRun } from '@/lib/reporting-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'export', 'reports.read')) return forbidden();

  const url = new URL(request.url);
  const reportType = url.searchParams.get('reportType');
  if (!reportType) {
    return NextResponse.json({ error: 'reportType is required.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${url.origin}/api/reports${url.search}`, {
      cache: 'no-store',
      headers: request.headers,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = await response.json();
    const rows = flattenRows(payload);
    const filters = Object.fromEntries(url.searchParams.entries());
    const generatedAt = new Date().toISOString();
    const fileName = `${reportType}-${generatedAt.slice(0, 10)}.csv`;

    await Promise.all([
      recordReportRun({
        branchId: ctx.branchId,
        category: 'legacy',
        filters,
        format: 'CSV',
        reportType,
        status: 'EXPORTED',
        userProfileId: ctx.userId,
      }),
      recordReportExport({
        branchId: ctx.branchId,
        category: 'legacy',
        fileName,
        filters,
        format: 'CSV',
        organizationId: ctx.organizationId,
        reportType,
        userProfileId: ctx.userId,
      }),
    ]);

    return new NextResponse(
      toReportCsv({
        filters,
        generatedAt,
        generatedBy: ctx.workId,
        rows,
        title: reportType,
      }),
      {
        headers: {
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Type': 'text/csv; charset=utf-8',
        },
      },
    );
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to export CSV.');
  }
}
