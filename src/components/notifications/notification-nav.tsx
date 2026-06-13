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
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              active
                ? 'bg-orange text-white'
                : 'border border-border bg-white text-brown hover:bg-cream dark:border-darkBorder dark:bg-darkCard dark:text-darkText dark:hover:bg-darkBg',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
