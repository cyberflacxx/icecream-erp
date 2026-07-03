'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/ui-library';

const items = [
  { href: '/notifications', label: 'Center' },
  { href: '/notifications/dashboard', label: 'Alert Dashboard' },
  { href: '/notifications/settings', label: 'Settings' },
  { href: '/notifications/delivery-logs', label: 'Delivery Logs' },
];

export function NotificationNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-lg px-3.5 py-2 text-[13px] font-semibold transition',
              active
                ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]'
                : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
