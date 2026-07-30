import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="surface-card p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-[color:var(--app-accent-strong)]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-[color:var(--app-muted)]">{subtitle}</p> : null}
      </div>
      <div className="dashboard-card-plot rounded-xl border border-[color:var(--app-border-muted)] bg-white p-4 text-slate-900 shadow-sm">
        {children}
      </div>
    </section>
  );
}
