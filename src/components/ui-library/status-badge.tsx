import { cva } from 'class-variance-authority';

import { cn } from './lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
  {
    variants: {
      variant: {
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/15 text-[#b45309] dark:text-warning',
        error: 'bg-error/10 text-error',
        info: 'bg-orange/10 text-orange',
        neutral: 'bg-cream text-muted dark:bg-darkBg dark:text-darkMuted'
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
