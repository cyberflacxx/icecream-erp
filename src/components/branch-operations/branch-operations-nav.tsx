'use client';

import Link from 'next/link';
import { Activity, ClipboardCheck, Package, Receipt, RotateCcw, ShoppingBasket, Users, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface BranchOperationsNavProps {
  branchId: string;
}

export function BranchOperationsNav({ branchId }: BranchOperationsNavProps) {
  const pathname = usePathname();
  const links = [
    {
      href: `/branches/${branchId}`,
      icon: Activity,
      label: 'Dashboard'
    },
    {
      href: `/branches/${branchId}/sales`,
      icon: ShoppingBasket,
      label: 'Sales'
    },
    {
      href: `/branches/${branchId}/stock`,
      icon: Package,
      label: 'Stock'
    },
    {
      href: `/branches/${branchId}/shifts`,
      icon: ClipboardCheck,
      label: 'Shifts'
    },
    {
      href: `/branches/${branchId}/expenses`,
      icon: Receipt,
      label: 'Expenses'
    },
    {
      href: `/branches/${branchId}/customers`,
      icon: Users,
      label: 'Customers'
    },
    {
      href: `/branches/${branchId}/payments`,
      icon: Wallet,
      label: 'Payments'
    },
    {
      href: `/branches/${branchId}/returns`,
      icon: RotateCcw,
      label: 'Returns'
    },
    {
      href: `/branches/${branchId}/shift-close`,
      icon: ClipboardCheck,
      label: 'Shift Close'
    },
    {
      href: `/branches/${branchId}/reports`,
      icon: Activity,
      label: 'Reports'
    }
  ] as const;

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
