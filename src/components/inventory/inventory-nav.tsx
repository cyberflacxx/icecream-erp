'use client';

import Link from 'next/link';
import { Boxes, ClockAlert, MoveRight, Package2, Rows3, Warehouse } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navLinks = [
  {
    href: '/inventory/items',
    label: 'Items',
    icon: Package2
  },
  {
    href: '/inventory/stock-balances',
    label: 'Stock Balances',
    icon: Boxes
  },
  {
    href: '/inventory/stock-movements',
    label: 'Stock Movements',
    icon: Rows3
  },
  {
    href: '/inventory/transfers',
    label: 'Transfers',
    icon: MoveRight
  },
  {
    href: '/inventory/expiring',
    label: 'Expiring',
    icon: ClockAlert
  },
  {
    href: '/inventory/warehouses',
    label: 'Warehouses',
    icon: Warehouse
  }
] as const;

export function InventoryNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="flex min-w-max gap-2">
        {navLinks.map((link) => {
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
