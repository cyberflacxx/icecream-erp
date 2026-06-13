import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';

function flattenRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.data)) return value.data as Array<Record<string, unknown>>;
  }
  return [];
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportType: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'reports.read', 'export')) return forbidden();

  try {
    const { reportType } = await params;
    const url = new URL(request.url);
    const target = `${url.origin}/api/hr/reports/${reportType}${url.search}`;
    const response = await fetch(target, { cache: 'no-store', headers: request.headers });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const rows = flattenRows(payload);
    const headers = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => JSON.stringify((row as Record<string, unknown>)[header] ?? '')).join(',')),
    ].join('\n');
    const fileName = `hr-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to export HR report.');
  }
}
