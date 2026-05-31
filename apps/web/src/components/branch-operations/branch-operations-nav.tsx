'use client';

import Link from 'next/link';
import { Activity, ClipboardCheck, ShoppingBasket } from 'lucide-react';
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
      href: `/branches/${branchId}/shift-close`,
      icon: ClipboardCheck,
      label: 'Shift Close'
    }
  ] as const;

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
