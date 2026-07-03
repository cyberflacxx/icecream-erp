'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/ui-library';

const links = [
  { href: '/testing', label: 'Dashboard' },
  { href: '/testing/test-cases', label: 'Test Cases' },
  { href: '/testing/test-runs', label: 'Test Runs' },
  { href: '/testing/bugs', label: 'Bug Tracker' },
  { href: '/testing/uat', label: 'UAT' },
  { href: '/testing/training', label: 'Training' },
  { href: '/testing/documentation', label: 'Documentation' },
  { href: '/testing/release-notes', label: 'Release Notes' },
  { href: '/testing/handover', label: 'Handover' },
];

export function TestingNav() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
                active
                  ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]'
                  : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
