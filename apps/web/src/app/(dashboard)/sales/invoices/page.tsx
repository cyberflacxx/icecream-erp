'use client';

import Link from 'next/link';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const invoices = [
  { id: 'INV-0042', order: 'SO-0021', customer: 'Eastgate Supermart', amount: '$860.00', paid: '$0.00', due: '14 Jun 2026', status: 'UNPAID' },
  { id: 'INV-0041', order: 'SO-0020', customer: 'Sunshine Café', amount: '$240.00', paid: '$240.00', due: '07 Jun 2026', status: 'PAID' },
  { id: 'INV-0040', order: 'SO-0018', customer: 'Avondale School', amount: '$390.00', paid: '$390.00', due: '06 Jun 2026', status: 'PAID' },
  { id: 'INV-0039', order: 'SO-0016', customer: 'City Retail Chain', amount: '$3,200.00', paid: '$3,200.00', due: '05 Jun 2026', status: 'PAID' },
  { id: 'INV-0038', order: 'SO-0014', customer: 'Harare Hotels Ltd', amount: '$2,100.00', paid: '$1,000.00', due: '01 Jun 2026', status: 'OVERDUE' },
  { id: 'INV-0037', order: 'SO-0013', customer: 'Borrowdale Fresh', amount: '$1,420.00', paid: '$0.00', due: '28 May 2026', status: 'OVERDUE' },
  { id: 'INV-0036', order: 'SO-0012', customer: 'Eastgate Supermart', amount: '$540.00', paid: '$540.00', due: '25 May 2026', status: 'PAID' },
];

const statusColors: Record<string, string> = {
  UNPAID: 'bg-blue-500/15 text-blue-400',
  PAID: 'bg-emerald-500/15 text-emerald-400',
  OVERDUE: 'bg-red-500/15 text-red-400',
  PARTIAL: 'bg-amber-500/15 text-amber-400',
  VOID: 'bg-white/8 text-white/30',
};

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Track billing, payment collection and overdue accounts."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/sales" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Outstanding', value: '$4,480.00', color: 'text-orange', bg: 'bg-orange/8 border-orange/20' },
          { label: 'Overdue (2)', value: '$3,520.00', color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/20' },
          { label: 'Collected This Month', value: '$4,370.00', color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.bg}`}>
            <p className="text-xs text-white/40">{c.label}</p>
            <p className={`mt-1.5 text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Invoice</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Customer</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Amount</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Paid</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Due Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-white/5 transition hover:bg-white/4 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-mono text-xs font-medium text-orange">{inv.id}</p>
                  <p className="text-[11px] text-white/30">{inv.order}</p>
                </td>
                <td className="px-5 py-3.5 font-medium text-white">{inv.customer}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-white">{inv.amount}</td>
                <td className="px-5 py-3.5 text-right text-white/60">{inv.paid}</td>
                <td className={`px-5 py-3.5 text-xs ${inv.status === 'OVERDUE' ? 'text-red-400 font-medium' : 'text-white/40'}`}>{inv.due}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusColors[inv.status]}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button aria-label="View invoice" className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
