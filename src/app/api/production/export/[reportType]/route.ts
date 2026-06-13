import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildReportCsv } from '@/lib/production';

async function fetchReport(request: Request, reportType: string) {
  const url = new URL(request.url);
  const origin = url.origin || 'http://localhost:3000';
  const target = `${origin}/api/production/reports/${reportType}${url.search}`;
  const response = await fetch(target, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  });
  if (!response.ok) {
    throw new Error(`Unable to export ${reportType} report.`);
  }
  return response.json() as Promise<Array<Record<string, unknown>>>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportType: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read', 'reports.read')) return forbidden();

  try {
    const { reportType } = await params;
    const rows = await fetchReport(request, reportType);
    const csv = buildReportCsv(rows);

    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="production-${reportType}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
