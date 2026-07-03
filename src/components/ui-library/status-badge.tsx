import { cva } from 'class-variance-authority';

import { cn } from './lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
  {
    variants: {
      variant: {
        success: 'border-emerald-200 bg-emerald-50 text-success dark:border-emerald-500/20 dark:bg-emerald-500/10',
        warning: 'border-amber-200 bg-amber-50 text-[#b45309] dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-warning',
        error: 'border-red-200 bg-red-50 text-error dark:border-red-500/20 dark:bg-red-500/10',
        info: 'border-[color:var(--app-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]',
        neutral: 'border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] text-[color:var(--app-muted)]'
      }
    },
    defaultVariants: {
      variant: 'neutral'
    }
  },
);

interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const resolvedVariant =
    variant ??
    (normalized.includes('approve') || normalized.includes('paid') || normalized.includes('active')
      ? 'success'
      : normalized.includes('pending') || normalized.includes('draft')
        ? 'warning'
        : normalized.includes('reject') || normalized.includes('cancel') || normalized.includes('failed')
          ? 'error'
          : 'neutral');

  return <span className={cn(badgeVariants({ variant: resolvedVariant }))}>{status}</span>;
}
