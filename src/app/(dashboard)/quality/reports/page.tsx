'use client';

import Link from 'next/link';

import { PageHeader } from '@/components/dashboard/page-header';
import { QualityNav } from '@/components/quality/quality-nav';
import { API_ROUTES } from '@/lib/shared';

const reports = [
  { href: API_ROUTES.QUALITY.REPORT_RAW_MATERIALS, label: 'Raw Material Quality' },
  { href: API_ROUTES.QUALITY.REPORT_PRODUCTION, label: 'Production Quality' },
  { href: API_ROUTES.QUALITY.REPORT_RETURNS, label: 'Returns Report' },
  { href: API_ROUTES.QUALITY.REPORT_DAMAGED_GOODS, label: 'Damaged Goods' },
  { href: API_ROUTES.QUALITY.REPORT_EXPIRED_GOODS, label: 'Expired Goods' },
  { href: API_ROUTES.QUALITY.REPORT_WASTE, label: 'Waste Disposal' },
  { href: API_ROUTES.QUALITY.REPORT_MARKET, label: 'Market Report' },
  { href: API_ROUTES.QUALITY.REPORT_FINANCIAL_IMPACT, label: 'Financial Impact' },
] as const;

export default function QualityReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="QC Reports" description="Review quality, returns, wastage, and financial impact reporting outputs." status="partial" />
      <QualityNav />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} href={report.href} className="rounded-2xl border border-border bg-white px-4 py-4 text-sm font-medium text-brown shadow-sm transition hover:border-brown hover:bg-cream">
            {report.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
