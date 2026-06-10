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
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          {eyebrow}
        </span>
      ) : null}
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-brown dark:text-darkText sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-base leading-7 text-muted dark:text-darkMuted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
