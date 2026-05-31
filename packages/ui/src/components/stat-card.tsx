import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'orange' | 'brown' | 'success' | 'warning';
}

const colorStyles = {
  orange: 'bg-orange/10 text-orange',
  brown: 'bg-brown/10 text-brown',
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
    <article className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted dark:text-darkMuted">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-brown dark:text-darkText">{value}</p>
        </div>
        <div className={cn('rounded-full p-3', colorStyles[color])}>{icon}</div>
      </div>
      {trendValue ? (
        <div
          className={cn(
            'mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
            trend === 'up' && 'bg-success/10 text-success',
            trend === 'down' && 'bg-error/10 text-error',
            trend === 'neutral' && 'bg-cream text-muted dark:bg-darkBg dark:text-darkMuted',
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
