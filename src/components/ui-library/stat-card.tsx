import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn } from './lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'orange' | 'brown' | 'success' | 'warning';
}

const colorStyles = {
  orange: 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]',
  brown: 'bg-slate-100 text-[color:var(--app-text)] dark:bg-slate-800/70 dark:text-[color:var(--app-text)]',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning'
} as const;

export function StatCard({
  title,
  value,
  icon,
  trend = 'neutral',
  trendValue,
  color = 'orange'
}: StatCardProps) {
  return (
    <article className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[color:var(--app-muted)]">{title}</p>
          <p className="mt-2.5 text-[1.9rem] font-semibold tracking-[-0.03em] text-[color:var(--app-text)]">{value}</p>
        </div>
        <div className={cn('rounded-lg border border-[color:var(--app-border)] p-2.5', colorStyles[color])}>{icon}</div>
      </div>
      {trendValue ? (
        <div
          className={cn(
            'mt-4 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
            trend === 'up' && 'bg-success/10 text-success',
            trend === 'down' && 'bg-error/10 text-error',
            trend === 'neutral' && 'border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] text-[color:var(--app-muted)]',
          )}
        >
          {trend === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
          {trend === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
          <span>{trendValue}</span>
        </div>
      ) : null}
    </article>
  );
}
