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
