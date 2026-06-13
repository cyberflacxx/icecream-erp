'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/ui-library';

const links = [
  { href: '/admin/migration', label: 'Migration' },
  { href: '/admin/opening-balances', label: 'Opening Balances' },
  { href: '/admin/backups', label: 'Backups' },
  { href: '/admin/health', label: 'Health' },
  { href: '/admin/data-integrity', label: 'Integrity' },
  { href: '/admin/deployment', label: 'Deployment' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-2xl px-4 py-3 text-sm font-medium transition',
              pathname === link.href
                ? 'bg-brown text-white dark:bg-darkBg dark:text-darkText'
                : 'text-muted hover:bg-cream hover:text-brown dark:text-darkMuted dark:hover:bg-darkBg dark:hover:text-darkText',
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
