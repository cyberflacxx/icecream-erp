'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';

const balanceGroups = [
  {
    title: 'Stock Opening Balances',
    description: 'This admin utility is not configured yet.',
  },
  {
    title: 'Customer Opening Balances',
    description: 'No customer opening balance workflow is configured.',
  },
  {
    title: 'Supplier Opening Balances',
    description: 'No supplier opening balance workflow is configured.',
  },
  {
    title: 'Account Opening Balances',
    description: 'No journal opening balance workflow is configured.',
  },
];

export default function AdminOpeningBalancesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Opening Balances</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review opening balances before posting them into the ERP. This admin utility is not configured yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
              Post Opening Balances
            </button>
            <Link
              href="/admin/migration"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Migration Center
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {balanceGroups.map((group) => (
          <article key={group.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{group.description}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">No data available</p>
              <p className="mt-1 text-sm text-slate-600">
                Configure the relevant opening-balance workflow before enabling posting actions.
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
