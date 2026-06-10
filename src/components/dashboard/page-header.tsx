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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange/25 bg-orange/10 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange">Operations Overview</p>
          </div>
          <FeatureBadge status={status} />
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-brown dark:text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brown/50 dark:text-white/50">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
