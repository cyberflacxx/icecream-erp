'use client';

import Link from 'next/link';
import { Building2, KeyRound, ScrollText, Shield, Users } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/settings', icon: Building2, label: 'Overview' },
  { href: '/settings/users', icon: Users, label: 'Users' },
  { href: '/settings/roles', icon: Shield, label: 'Roles' },
  { href: '/settings/permissions', icon: KeyRound, label: 'Permissions' },
  { href: '/settings/audit-logs', icon: ScrollText, label: 'Audit Logs' }
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition',
                isActive
                  ? 'bg-brown text-white shadow-sm dark:bg-darkBg dark:text-darkText'
                  : 'text-muted hover:bg-cream hover:text-brown dark:text-darkMuted dark:hover:bg-darkBg dark:hover:text-darkText',
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
