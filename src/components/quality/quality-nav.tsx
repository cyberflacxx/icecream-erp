'use client';

import Link from 'next/link';
import { AlertTriangle, ClipboardCheck, FileWarning, PackageCheck, RotateCcw, ScanSearch, Store } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/quality', icon: ClipboardCheck, label: 'Dashboard' },
  { href: '/quality/inspections', icon: ScanSearch, label: 'Inspections' },
  { href: '/quality/returns', icon: RotateCcw, label: 'Returns' },
  { href: '/quality/damaged-goods', icon: AlertTriangle, label: 'Damaged' },
  { href: '/quality/expired-goods', icon: FileWarning, label: 'Expired' },
  { href: '/quality/market-reports', icon: Store, label: 'Market' },
  { href: '/quality/reports', icon: PackageCheck, label: 'Reports' },
] as const;

export function QualityNav() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
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
