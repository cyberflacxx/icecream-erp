'use client';

import Link from 'next/link';
import { Rocket } from 'lucide-react';

const readinessCards = [
  { title: 'Environment Checks', value: 'Unavailable', detail: 'This admin utility is not configured yet.' },
  { title: 'Checklist Items', value: 'Unavailable', detail: 'Deployment checklist data is not configured.' },
  { title: 'Go-Live Status', value: 'Not requested', detail: 'Approval workflow is not configured.' },
];

const checklistRows = [
  { item: 'Confirm production environment variables', owner: 'Administrator', status: 'Pending setup' },
  { item: 'Verify backup and restore readiness', owner: 'Operations', status: 'Pending setup' },
  { item: 'Approve go-live signoff', owner: 'Management', status: 'Pending setup' },
];

export default function AdminDeploymentPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Deployment Readiness</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review go-live readiness controls and deployment blockers. This admin utility is not configured yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
              Run Readiness Check
            </button>
            <button type="button" disabled className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500">
              Request Go-Live
            </button>
            <Link
              href="/admin/health"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View Health
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {readinessCards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-sky-100 p-3 text-sky-700">
            <Rocket className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Go-Live Checklist</h2>
            <p className="text-sm text-slate-600">
              Placeholder deployment items are shown until the readiness workflow is configured.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Checklist Item</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {checklistRows.map((row) => (
                <tr key={row.item} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{row.item}</td>
                  <td className="px-4 py-3 text-slate-600">{row.owner}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      {row.status}
                    </span>
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
