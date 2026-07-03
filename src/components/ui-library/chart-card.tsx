import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-semibold tracking-[-0.02em] text-[color:var(--app-text)]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-[color:var(--app-muted)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
