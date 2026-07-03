import type { ReactNode } from 'react';

import { cn } from './lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  action?: ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  action
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'mx-auto max-w-3xl items-center text-center',
      )}
    >
      {eyebrow ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-accent-strong)]">
          {eyebrow}
        </span>
      ) : null}
      <div className="space-y-3">
        <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[color:var(--app-text)] sm:text-[2rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--app-muted)] sm:text-base">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
