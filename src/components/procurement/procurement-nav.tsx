'use client';

import Link from 'next/link';
import { ClipboardList, FileCheck2, LayoutDashboard, PackageCheck, ReceiptText, ShieldAlert, Truck, Undo2, WalletCards } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  {
    href: '/procurement/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard'
  },
  {
    href: '/procurement/suppliers',
    icon: Truck,
    label: 'Suppliers'
  },
  {
    href: '/procurement/requisitions',
    icon: ClipboardList,
    label: 'Requisitions'
  },
  {
    href: '/procurement/purchase-orders',
    icon: FileCheck2,
    label: 'Purchase Orders'
  },
  {
    href: '/procurement/goods-received',
    icon: PackageCheck,
    label: 'Goods Received'
  },
  {
    href: '/procurement/shortages',
    icon: ShieldAlert,
    label: 'Shortages'
  },
  {
    href: '/procurement/returns',
    icon: Undo2,
    label: 'Returns'
  },
  {
    href: '/procurement/invoices',
    icon: ReceiptText,
    label: 'Invoices'
  },
  {
    href: '/procurement/payments',
    icon: WalletCards,
    label: 'Payments'
  }
] as const;

export function ProcurementNav() {
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
