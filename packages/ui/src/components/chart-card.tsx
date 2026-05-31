import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-muted dark:text-darkMuted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
