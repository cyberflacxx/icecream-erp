import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createBrandedPdfDocument, type BrandedPdfTableColumn } from '@/lib/pdf';
import { recordReportExport, recordReportRun } from '@/lib/reporting-server';

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isNumericColumn(key: string, rows: Array<Record<string, unknown>>) {
  const normalized = key.toLowerCase();
  if (/(qty|quantity|count|total|amount|value|cost|price|sales|revenue|balance|tax|discount|hours|rate|percent)/.test(normalized)) {
    return true;
  }

  return rows.some((row) => typeof row[key] === 'number');
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'export', 'reports.read')) return forbidden();

  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get('reportType') ?? 'report';
    const title = titleCase(reportType);
    const reportUrl = new URL('/api/reports', url.origin);
    reportUrl.search = url.searchParams.toString();

    const reportResponse = await fetch(reportUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      method: 'GET',
    });

    const payload = await reportResponse.json().catch(() => null);
    if (!reportResponse.ok) {
      return serverError((payload as { error?: string } | null)?.error ?? 'Failed to generate report PDF.');
    }

    const report = payload as {
      chart?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
      summary?: Record<string, unknown>;
    };
    const data = report.data ?? [];
    const summary = report.summary ?? {};
    const filters = Object.fromEntries(url.searchParams.entries());
    const generatedAt = new Date().toISOString();
    const columns = Object.keys(data[0] ?? {});
    const tableColumns: BrandedPdfTableColumn[] = columns.map((column) => ({
      align: isNumericColumn(column, data) ? 'right' : 'left',
      header: titleCase(column),
      key: column,
    }));
    const summaryItems = Object.entries(summary).map(([key, value]) => ({
      label: titleCase(key),
      value: formatCell(value) || '-',
    }));
    const metadata = [
      {
        label: 'Date Range',
        value: `${url.searchParams.get('startDate') ?? 'N/A'} to ${url.searchParams.get('endDate') ?? 'N/A'}`,
      },
      ...Object.entries(filters)
        .filter(([key, value]) => key !== 'reportType' && key !== 'startDate' && key !== 'endDate' && value)
        .slice(0, 4)
        .map(([key, value]) => ({
          label: titleCase(key),
          value: String(value),
        })),
    ];
    const sections = [
      ...(data.length > 200 ? [{
        lines: [`Output truncated to the first 200 rows of ${data.length} total rows.`],
        title: 'Export Notes',
      }] : []),
    ];

    const fileName = `${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const pdf = createBrandedPdfDocument({
      footerNote: 'This report was generated from Absolute Ice Cream ERP.',
      generatedAt,
      generatedBy: ctx.workId,
      metadata,
      sections,
      subtitle: `${title} export generated for the selected reporting period.`,
      summary: summaryItems,
      table: {
        columns: tableColumns,
        rows: data.slice(0, 200),
        title: 'Report Data',
      },
      title: `${title} Report`,
    });

    await Promise.all([
      recordReportRun({
        branchId: ctx.branchId,
        category: 'general',
        filters,
        format: 'PDF',
        reportType,
        status: 'COMPLETED',
        userProfileId: ctx.userId,
      }),
      recordReportExport({
        branchId: ctx.branchId,
        category: 'general',
        fileName,
        filters,
        format: 'PDF',
        organizationId: ctx.organizationId,
        reportType,
        userProfileId: ctx.userId,
      }),
    ]);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to export report PDF.');
  }
}
