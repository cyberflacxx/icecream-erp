import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn } from './lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'orange' | 'brown' | 'success' | 'warning' | 'danger';
}

const colorStyles = {
  orange: 'bg-white/18 text-white border-white/20',
  brown: 'bg-white/12 text-white border-white/16',
  success: 'bg-emerald-400/18 text-white border-emerald-200/20',
  warning: 'bg-amber-300/18 text-white border-amber-200/20',
  danger: 'bg-white/18 text-white border-white/24'
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
    <article className={cn('dashboard-blue-card p-5', color === 'danger' && 'dashboard-danger-card')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="dashboard-blue-label text-sm font-semibold">{title}</p>
          <p className="dashboard-blue-value mt-2.5 text-[1.9rem] font-bold tracking-[-0.03em]">{value}</p>
        </div>
        <div className={cn('dashboard-blue-icon p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.18)]', colorStyles[color])}>{icon}</div>
      </div>
      {trendValue ? (
        <div
          className={cn(
            'dashboard-blue-badge mt-4',
            trend === 'up' && 'bg-emerald-400/18 text-white border-emerald-200/18',
            trend === 'down' && 'bg-rose-400/18 text-white border-rose-200/18',
            trend === 'neutral' && 'bg-white/12 text-white border-white/16',
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
