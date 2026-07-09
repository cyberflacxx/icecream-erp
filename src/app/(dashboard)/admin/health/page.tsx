import Link from 'next/link';
import { Activity } from 'lucide-react';

const systemAreas = [
  { area: 'Database connectivity', status: 'Not configured', detail: 'System health checks are not configured yet.' },
  { area: 'Environment verification', status: 'Not configured', detail: 'No runtime environment checks are wired.' },
  { area: 'Service readiness', status: 'Not configured', detail: 'No service metrics are available yet.' },
];

export default function AdminHealthPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">System Health</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review core service health and readiness indicators. This admin utility is not configured yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
              Run Health Check
            </button>
            <Link
              href="/admin/deployment"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Deployment Readiness
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {systemAreas.map((item) => (
          <article key={item.area} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.area}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{item.status}</p>
            <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Health Summary</h2>
            <p className="text-sm text-slate-600">
              No active health integrations are configured for this dashboard page.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">This admin utility is not configured yet.</p>
          <p className="mt-2 text-sm text-slate-600">
            Add the required health-check services and data sources before enabling live monitoring actions.
          </p>
        </div>
      </section>
    </div>
  );
}
