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
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
              pathname === link.href
                ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]'
                : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
