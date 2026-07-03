'use client';

import Link from 'next/link';
import { Boxes, ChartColumnBig, ClockAlert, ClipboardCheck, LayoutDashboard, MoveRight, Package2, ReceiptText, Rows3, ShieldAlert, Warehouse } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navLinks = [
  {
    href: '/inventory/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
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
    href: '/inventory/stores',
    label: 'Stores',
    icon: ReceiptText
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
    href: '/inventory/supplier-shortages',
    label: 'Shortages',
    icon: ShieldAlert
  },
  {
    href: '/inventory/approvals',
    label: 'Approvals',
    icon: ClipboardCheck
  },
  {
    href: '/inventory/reports',
    label: 'Reports',
    icon: ChartColumnBig
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
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
                isActive
                  ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)] shadow-sm'
                  : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
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
