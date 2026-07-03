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
        'inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3.5 py-2 text-[13px] font-medium text-[color:var(--app-text)] shadow-sm',
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
