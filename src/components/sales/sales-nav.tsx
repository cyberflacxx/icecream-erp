'use client';

import Link from 'next/link';
import { BadgePercent, ClipboardList, FileSpreadsheet, LayoutDashboard, ReceiptText, RotateCcw, Tags, Truck, Users, WalletCards } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/sales/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/sales/customers', icon: Users, label: 'Customers' },
  { href: '/sales/prices', icon: Tags, label: 'Prices' },
  { href: '/sales/discounts', icon: BadgePercent, label: 'Discounts' },
  { href: '/sales/quotations', icon: FileSpreadsheet, label: 'Quotations' },
  { href: '/sales/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/sales/invoices', icon: ReceiptText, label: 'Invoices' },
  { href: '/sales/dispatches', icon: Truck, label: 'Dispatches' },
  { href: '/sales/payments', icon: WalletCards, label: 'Payments' },
  { href: '/sales/returns', icon: RotateCcw, label: 'Returns' },
] as const;

export function SalesNav() {
  const pathname = usePathname();

  return (
    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-sm">
      <div className="overflow-x-auto px-1.5 py-1.5 [scrollbar-width:thin]">
        <div className="flex min-w-max gap-2 pr-2">
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
    </div>
  );
}
