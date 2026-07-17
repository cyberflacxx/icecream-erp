'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui-library';

interface FinanceEmptyStateProps {
  actionLabel?: string;
  description: string;
  href?: string;
  icon: ReactNode;
  onAction?: () => void;
  title: string;
}

export function FinanceEmptyState({
  actionLabel,
  description,
  href,
  icon,
  onAction,
  title,
}: FinanceEmptyStateProps) {
  const action =
    actionLabel && href ? (
      <Button asChild size="sm">
        <Link href={href}>{actionLabel}</Link>
      </Button>
    ) : actionLabel && onAction ? (
      <Button type="button" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null;

  return <EmptyState icon={icon} title={title} description={description} action={action} />;
}
