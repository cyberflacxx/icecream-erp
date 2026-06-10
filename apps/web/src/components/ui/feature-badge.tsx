'use client';

type Status = 'live' | 'partial' | 'planned';

interface FeatureBadgeProps {
  status: Status;
  label?: string;
}

const config: Record<Status, { dot: string; bg: string; text: string; defaultLabel: string }> = {
  live:    { dot: 'bg-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', text: 'text-emerald-600 dark:text-emerald-400', defaultLabel: 'Live' },
  partial: { dot: 'bg-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20',     text: 'text-amber-600 dark:text-amber-400',   defaultLabel: 'In Progress' },
  planned: { dot: 'bg-red-400',     bg: 'bg-red-400/10 border-red-400/20',         text: 'text-red-600 dark:text-red-400',       defaultLabel: 'Planned' },
};

export function FeatureBadge({ status, label }: FeatureBadgeProps) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {label ?? c.defaultLabel}
    </span>
  );
}
