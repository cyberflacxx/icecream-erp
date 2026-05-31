'use client';

import Link from 'next/link';
import {
  BarChart3,
  Factory,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Warehouse
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { PermissionGate, cn } from '@absolute-ice-cream/ui';
import { PERMISSIONS } from '@absolute-ice-cream/shared';

import { useUserContext } from '@/contexts/UserContext';
import { logoutAndRedirect } from '@/lib/logout';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    permission: PERMISSIONS.dashboard.read,
    comingSoon: false
  },
  {
    href: '/procurement/suppliers',
    icon: Truck,
    label: 'Procurement',
    permission: PERMISSIONS.supplier.read,
    comingSoon: false
  },
  {
    href: '/inventory',
    icon: Warehouse,
    label: 'Inventory',
    permission: PERMISSIONS.inventory.read,
    comingSoon: false
  },
  {
    href: '/production',
    icon: Factory,
    label: 'Production',
    permission: PERMISSIONS.productionBatch.read,
    comingSoon: false
  },
  {
    href: '/branches',
    icon: ShoppingCart,
    label: 'Branch Ops',
    permission: PERMISSIONS.branchSales.read,
    comingSoon: false
  },
  {
    href: '/finance',
    icon: Receipt,
    label: 'Finance',
    permission: PERMISSIONS.finance.read,
    comingSoon: false
  },
  {
    href: '/reports',
    icon: BarChart3,
    label: 'Reports',
    permission: PERMISSIONS.reports.read,
    comingSoon: false
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Settings',
    permission: PERMISSIONS.settings.manage,
    comingSoon: false
  }
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useUserContext();

  return (
    <aside className="flex h-full flex-col border-r border-brown/10 bg-brown px-4 py-6 text-white dark:border-darkBorder dark:bg-darkCard">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange text-white">
            A
          </div>
          <div>
            <p className="font-semibold">Absolute Ice Cream ERP</p>
            <p className="text-xs text-white/65">Absolute Quality Icecream</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/50">Signed in as</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {currentUser?.profile.fullName ?? 'ERP User'}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {currentUser?.roles.map((role) => role.name).join(' | ') ?? 'Awaiting role sync'}
          </p>
        </div>
      </div>

      <nav className="mt-8 flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <PermissionGate key={item.label} permission={item.permission}>
              {item.comingSoon ? (
                <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-white/65">
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                    Soon
                  </span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive
                      ? 'bg-white text-brown shadow-sm dark:bg-darkBg dark:text-darkText'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )}
            </PermissionGate>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={async () => {
          await logoutAndRedirect(router);
        }}
        className="mt-4 flex items-center gap-3 rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
}
