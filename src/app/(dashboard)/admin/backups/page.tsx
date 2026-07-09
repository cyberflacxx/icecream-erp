export default function AdminBackupsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Backup Management
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage backup readiness, manual backup actions, and restore controls for Absolute Ice Cream ERP.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Backup Status</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Not configured</h2>
            <p className="mt-2 text-sm text-slate-600">Backup controls are not configured yet.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Last Backup</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">No record</h2>
            <p className="mt-2 text-sm text-slate-600">No backup history is available yet.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Restore Status</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Manual only</h2>
            <p className="mt-2 text-sm text-slate-600">Restore actions should be handled by the system administrator.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Backup Controls</h2>
          <p className="mt-1 text-sm text-slate-600">
            These controls are placeholders until automated backup APIs are configured.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Create Backup
            </button>
            <button
              type="button"
              disabled
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Download Latest
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">
              Backup controls are not configured yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Configure server-side backup scripts before enabling these actions.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
