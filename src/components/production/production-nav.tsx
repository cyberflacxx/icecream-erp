'use client';

import Link from 'next/link';
import { Boxes, Factory, FileSpreadsheet, LayoutDashboard, PackageCheck, RefreshCcw, Rows3 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/production/dashboard', icon: LayoutDashboard, label: 'Overview', match: 'overview' },
  { href: '/production/recipes', icon: FileSpreadsheet, label: 'BOM' },
  { href: '/production/batches?stage=issue', icon: Factory, label: 'Issues', match: 'issue' },
  { href: '/production/batches?stage=release', icon: PackageCheck, label: 'Release', match: 'release' },
  { href: '/inventory/stock-balances', icon: Boxes, label: 'Stock Balance', match: 'stock-balance' },
  { href: '/production/transfers', icon: RefreshCcw, label: 'Transfers In', match: 'transfers' },
  { href: '/production/reports', icon: Rows3, label: 'Reports' },
] as const;

export function ProductionNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = searchParams.get('stage');

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.match === 'issue'
              ? pathname === '/production/batches' && stage === 'issue'
              : link.match === 'release'
                ? pathname === '/production/batches' && stage === 'release'
                : link.match === 'overview'
                  ? pathname === '/production/dashboard'
                  : link.match === 'stock-balance'
                    ? pathname === '/inventory/stock-balances'
                    : link.match === 'transfers'
                      ? pathname === '/production/transfers'
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
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
