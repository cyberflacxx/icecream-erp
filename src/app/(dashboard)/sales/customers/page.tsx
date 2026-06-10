'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Eye, Plus } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const customers = [
  { id: 'C-001', name: 'Eastgate Supermart', contact: 'John Moyo', phone: '+263 77 123 4567', creditLimit: '$5,000', balance: '$860', status: 'GOOD' },
  { id: 'C-002', name: 'Sunshine Café', contact: 'Mary Choto', phone: '+263 71 234 5678', creditLimit: '$2,000', balance: '$240', status: 'GOOD' },
  { id: 'C-003', name: 'Borrowdale Fresh', contact: 'Peter Ndlovu', phone: '+263 78 345 6789', creditLimit: '$8,000', balance: '$7,900', status: 'NEAR_LIMIT' },
  { id: 'C-004', name: 'Avondale School', contact: 'Mrs. Sithole', phone: '+263 77 456 7890', creditLimit: '$1,500', balance: '$0', status: 'GOOD' },
  { id: 'C-005', name: 'Harare Hotels Ltd', contact: 'James Mhuru', phone: '+263 71 567 8901', creditLimit: '$15,000', balance: '$14,200', status: 'OVER_LIMIT' },
  { id: 'C-006', name: 'City Retail Chain', contact: 'Susan Zulu', phone: '+263 78 678 9012', creditLimit: '$10,000', balance: '$3,200', status: 'GOOD' },
  { id: 'C-007', name: 'Chisipite Mall', contact: 'Robert Chikwanda', phone: '+263 77 789 0123', creditLimit: '$6,000', balance: '$0', status: 'GOOD' },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  GOOD: { label: 'Good', color: 'bg-emerald-500/15 text-emerald-400' },
  NEAR_LIMIT: { label: 'Near Limit', color: 'bg-amber-500/15 text-amber-400' },
  OVER_LIMIT: { label: 'Over Limit', color: 'bg-red-500/15 text-red-400' },
  BLOCKED: { label: 'Blocked', color: 'bg-red-900/40 text-red-300' },
};

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer accounts, credit limits and payment history."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/sales" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange">
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          </div>
        }
      />

      {/* Over-limit alert */}
      <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
        <div>
          <p className="text-sm font-semibold text-red-300">1 customer over credit limit</p>
          <p className="mt-0.5 text-xs text-red-400/70">Harare Hotels Ltd has exceeded their $15,000 credit limit. New orders are blocked until payment is received.</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">ID</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Customer</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Contact</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Credit Limit</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Balance</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
                const cfg = statusConfig[c.status] ?? { label: c.status, color: 'bg-white/8 text-white/40' };
              return (
                <tr key={c.id} className="border-b border-white/5 transition hover:bg-white/4 last:border-0">
                  <td className="px-5 py-3.5 font-mono text-xs text-white/40">{c.id}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-[11px] text-white/40">{c.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-white/50">{c.contact}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-white">{c.creditLimit}</td>
                  <td className={`px-5 py-3.5 text-right font-semibold ${c.status === 'OVER_LIMIT' ? 'text-red-400' : c.status === 'NEAR_LIMIT' ? 'text-amber-400' : 'text-white'}`}>
                    {c.balance}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
