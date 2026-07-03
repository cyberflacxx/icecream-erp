import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--app-bg-subtle)] text-[color:var(--app-accent)]">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-[color:var(--app-text)]">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[color:var(--app-muted)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
