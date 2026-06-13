'use client';

import { cn } from '@/lib/utils';

export function WorkflowStatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = String(status ?? '').toUpperCase();
  const tone =
    normalized === 'APPROVED' || normalized === 'POSTED' || normalized === 'APPLIED'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : normalized === 'REJECTED' || normalized === 'FAILED' || normalized === 'VOIDED' || normalized === 'REVERSED'
        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>{normalized || 'UNKNOWN'}</span>;
}
