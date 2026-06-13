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
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-2xl px-4 py-3 text-sm font-medium transition',
                active
                  ? 'bg-brown text-white dark:bg-darkBg dark:text-darkText'
                  : 'text-muted hover:bg-cream hover:text-brown dark:text-darkMuted dark:hover:bg-darkBg dark:hover:text-darkText',
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
