'use client';

import Link from 'next/link';
import { ArrowDownToLine, DatabaseZap } from 'lucide-react';

const migrationCards = [
  { title: 'Migration Batches', value: 'Unavailable', detail: 'This admin utility is not configured yet.' },
  { title: 'Validation Queue', value: 'Unavailable', detail: 'No migration validator is configured.' },
  { title: 'Import Status', value: 'Unavailable', detail: 'No import runner is configured.' },
];

const migrationRows = [
  { batch: 'Opening stock balances', action: 'Validate', status: 'Pending setup' },
  { batch: 'Customer opening balances', action: 'Approve', status: 'Pending setup' },
  { batch: 'Supplier opening balances', action: 'Import', status: 'Pending setup' },
];

export default function AdminMigrationPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Migration Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Prepare import batches, validation, and approvals. This admin utility is not configured yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
              Create Batch
            </button>
            <button type="button" disabled className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500">
              Upload Template
            </button>
            <Link
              href="/admin/opening-balances"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Opening Balances
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {migrationCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-violet-100 p-3 text-violet-700">
            <DatabaseZap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Migration Actions</h2>
            <p className="text-sm text-slate-600">
              Placeholder actions keep this route compiling until migration tooling is configured.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Primary Action</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Run</th>
              </tr>
            </thead>
            <tbody>
              {migrationRows.map((row) => (
                <tr key={row.batch} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{row.batch}</td>
                  <td className="px-4 py-3 text-slate-600">{row.action}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
