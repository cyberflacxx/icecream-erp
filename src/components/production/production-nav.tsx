'use client';

import Link from 'next/link';
import { ClipboardList, Droplets, Factory, FileSpreadsheet, LayoutDashboard, PackageCheck, RefreshCcw, Rows3, TimerReset } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/production/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/production/recipes', icon: FileSpreadsheet, label: 'Recipes' },
  { href: '/production/plans', icon: ClipboardList, label: 'Plans' },
  { href: '/production/requests', icon: PackageCheck, label: 'Requests' },
  { href: '/production/batches', icon: Factory, label: 'Batches' },
  { href: '/production/shifts', icon: TimerReset, label: 'Shifts' },
  { href: '/production/wastage', icon: Droplets, label: 'Wastage' },
  { href: '/production/transfers', icon: RefreshCcw, label: 'Transfers' },
  { href: '/production/reports', icon: Rows3, label: 'Reports' },
] as const;

export function ProductionNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition',
                isActive ? 'bg-brown text-white shadow-sm' : 'text-muted hover:bg-cream hover:text-brown',
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
