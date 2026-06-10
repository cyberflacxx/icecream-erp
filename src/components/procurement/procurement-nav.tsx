'use client';

import Link from 'next/link';
import { ClipboardList, FileCheck2, PackageCheck, Truck } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
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
  }
] as const;

export function ProcurementNav() {
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
