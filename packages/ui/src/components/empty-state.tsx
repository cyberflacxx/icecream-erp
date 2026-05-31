import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream text-orange dark:bg-darkBg">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold text-brown dark:text-darkText">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted dark:text-darkMuted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
