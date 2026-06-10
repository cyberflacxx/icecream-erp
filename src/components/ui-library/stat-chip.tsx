import type { ReactNode } from 'react';

import { cn } from './lib/utils';

interface StatChipProps {
  label: string;
  icon?: ReactNode;
  className?: string;
}

export function StatChip({ label, icon, className }: StatChipProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brown dark:border-darkBorder dark:bg-darkCard dark:text-darkText',
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
