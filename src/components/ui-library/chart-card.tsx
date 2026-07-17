import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="dashboard-blue-card p-5">
      <div className="mb-5">
        <h3 className="dashboard-blue-value text-base font-semibold tracking-[-0.02em]">{title}</h3>
        {subtitle ? <p className="dashboard-blue-copy mt-1 text-sm">{subtitle}</p> : null}
      </div>
      <div className="dashboard-card-plot rounded-[1.25rem] border border-white/20 bg-white/96 p-4 text-slate-900 shadow-inner shadow-slate-900/5">
        {children}
      </div>
    </section>
  );
}
