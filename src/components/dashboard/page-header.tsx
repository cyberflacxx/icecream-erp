import type { ReactNode } from 'react';
import { FeatureBadge } from '@/components/ui/feature-badge';

type FeatureStatus = 'live' | 'partial' | 'planned';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  status?: FeatureStatus;
}

export function PageHeader({ title, description, actions, status = 'live' }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-accent-soft)] px-3 py-1 shadow-[var(--app-shadow-sm)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--app-accent-strong)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-accent-strong)]">Operations Overview</p>
          </div>
          <FeatureBadge status={status} />
        </div>
        <h1 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.03em] text-[color:var(--app-text)] sm:text-[2.1rem]">{title}</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[color:var(--app-muted)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}
