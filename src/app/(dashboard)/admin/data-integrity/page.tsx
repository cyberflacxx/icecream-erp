import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

const integrityCards = [
  {
    title: 'Integrity Status',
    value: 'Not configured',
    detail: 'This admin utility is not configured yet.',
  },
  {
    title: 'Latest Check',
    value: 'No record',
    detail: 'No integrity run has been captured in this environment.',
  },
  {
    title: 'Blocking Issues',
    value: 'Unavailable',
    detail: 'Configure the checker before issue counts can appear.',
  },
];

const issuePlaceholders = [
  {
    issue: 'Negative stock balances',
    module: 'Inventory',
    status: 'Pending setup',
  },
  {
    issue: 'Unbalanced journal entries',
    module: 'Finance',
    status: 'Pending setup',
  },
  {
    issue: 'Duplicate document numbers',
    module: 'Shared services',
    status: 'Pending setup',
  },
];

export default function AdminDataIntegrityPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Data Integrity</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review integrity blockers and deployment risks. This admin utility is not configured yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Run Integrity Check
            </button>
            <Link
              href="/admin/backups"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Backups
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {integrityCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Integrity Issue Queue</h2>
            <p className="text-sm text-slate-600">
              Placeholder rows keep this route available until the integrity workflow is wired.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Issue</th>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {issuePlaceholders.map((row) => (
                <tr key={row.issue} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{row.issue}</td>
                  <td className="px-4 py-3 text-slate-600">{row.module}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500"
                    >
                      Resolve
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
