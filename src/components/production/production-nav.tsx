'use client';

import Link from 'next/link';
import { Archive, ClipboardList, Factory, LayoutDashboard, PackageCheck, Rows3, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

type ProductionNavLink = {
  href: string;
  icon: LucideIcon;
  label: string;
  match?: 'dashboard' | 'issues' | 'legacy' | 'orders' | 'planned' | 'receipts' | 'reports';
  legacy?: boolean;
};

const links = [
  { href: '/production/dashboard', icon: LayoutDashboard, label: 'Dashboard', match: 'dashboard' },
  { href: '/production/orders', icon: ScrollText, label: 'Production Orders', match: 'orders' },
  { href: '/production/orders/new', icon: ClipboardList, label: 'Planned Production', match: 'planned' },
  { href: '/production/orders?workflow=issue&status=RELEASED', icon: Factory, label: 'Issues', match: 'issues' },
  { href: '/production/orders?workflow=receipt&status=RELEASED', icon: PackageCheck, label: 'Receipts', match: 'receipts' },
  { href: '/production/reports', icon: Rows3, label: 'Reports', match: 'reports' },
  { href: '/production/batches', icon: Archive, label: 'Legacy Batches', match: 'legacy', legacy: true },
] satisfies ProductionNavLink[];

export function ProductionNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workflow = searchParams.get('workflow');

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.match === 'dashboard'
              ? pathname === '/production/dashboard'
              : link.match === 'orders'
                ? pathname === '/production/orders' && workflow !== 'issue' && workflow !== 'receipt'
                : link.match === 'planned'
                  ? pathname === '/production/orders/new' || pathname.endsWith('/edit')
                  : link.match === 'issues'
                    ? pathname === '/production/orders' && workflow === 'issue'
                    : link.match === 'receipts'
                      ? pathname === '/production/orders' && workflow === 'receipt'
                      : link.match === 'legacy'
                        ? pathname === '/production/batches'
                        : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
                isActive ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)] shadow-sm' : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{link.label}</span>
              {link.legacy ? <span className="rounded bg-[color:var(--app-bg-subtle)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]">Legacy</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
