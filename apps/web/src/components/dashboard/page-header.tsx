import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange">Operations Overview</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brown sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
