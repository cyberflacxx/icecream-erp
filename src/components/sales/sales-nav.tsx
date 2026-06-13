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
