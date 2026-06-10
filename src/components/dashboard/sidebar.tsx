'use client';

import Link from 'next/link';
import {
  BarChart3,
  Building2,
  DollarSign,
  Factory,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UsersRound,
  Wallet,
  Warehouse,
  Wrench
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { PermissionGate, cn } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { useUserContext } from '@/contexts/UserContext';
import { logoutAndRedirect } from '@/lib/logout';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    permission: PERMISSIONS.dashboard.read,
    color: 'text-orange',
    bgActive: 'bg-orange/15',
  },
  {
    href: '/procurement/suppliers',
    icon: Truck,
    label: 'Procurement',
    permission: PERMISSIONS.supplier.read,
    color: 'text-blue-400',
    bgActive: 'bg-blue-500/15',
  },
  {
    href: '/inventory',
    icon: Warehouse,
    label: 'Inventory',
    permission: PERMISSIONS.inventory.read,
    color: 'text-emerald-400',
    bgActive: 'bg-emerald-500/15',
  },
  {
    href: '/production',
    icon: Factory,
    label: 'Production',
    permission: PERMISSIONS.productionBatch.read,
    color: 'text-violet-400',
    bgActive: 'bg-violet-500/15',
  },
  {
    href: '/branches',
    icon: Building2,
    label: 'Branch Ops',
    permission: PERMISSIONS.branchSales.read,
    color: 'text-pink-400',
    bgActive: 'bg-pink-500/15',
  },
  {
    href: '/sales',
    icon: ShoppingCart,
    label: 'Sales',
    permission: PERMISSIONS.branchSales.read,
    color: 'text-yellow-400',
    bgActive: 'bg-yellow-500/15',
  },
  {
    href: '/finance',
    icon: Wallet,
    label: 'Finance',
    permission: PERMISSIONS.finance.read,
    color: 'text-teal-400',
    bgActive: 'bg-teal-500/15',
  },
  {
    href: '/hr',
    icon: UsersRound,
    label: 'HR & Payroll',
    permission: PERMISSIONS.finance.read,
    color: 'text-indigo-400',
    bgActive: 'bg-indigo-500/15',
  },
  {
    href: '/quality',
    icon: FlaskConical,
    label: 'Quality Control',
    permission: PERMISSIONS.inventory.read,
    color: 'text-lime-400',
    bgActive: 'bg-lime-500/15',
  },
  {
    href: '/cost-accounting',
    icon: DollarSign,
    label: 'Cost Accounting',
    permission: PERMISSIONS.finance.read,
    color: 'text-amber-400',
    bgActive: 'bg-amber-500/15',
  },
  {
    href: '/maintenance',
    icon: Wrench,
    label: 'Maintenance',
    permission: PERMISSIONS.inventory.read,
    color: 'text-cyan-400',
    bgActive: 'bg-cyan-500/15',
  },
  {
    href: '/budget',
    icon: Receipt,
    label: 'Budget',
    permission: PERMISSIONS.finance.read,
    color: 'text-teal-300',
    bgActive: 'bg-teal-500/15',
  },
  {
    href: '/reports',
    icon: BarChart3,
    label: 'Reports',
    permission: PERMISSIONS.reports.read,
    color: 'text-orange-400',
    bgActive: 'bg-orange-500/15',
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Settings',
    permission: PERMISSIONS.settings.manage,
    color: 'text-slate-400',
    bgActive: 'bg-slate-500/15',
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useUserContext();

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-[#0D0500]">
      {/* Brand */}
      <div className="border-b border-white/10 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-orange text-white font-bold text-sm shadow-glow-sm">
            A
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Absolute Ice Cream ERP</p>
            <p className="text-[10px] text-white/50">Manufacturing Intelligence</p>
          </div>
        </div>

        {/* User card */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/7 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Signed in as</p>
          <p className="mt-1.5 truncate text-sm font-semibold text-white">
            {currentUser?.profile?.fullName ?? 'ERP User'}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <p className="truncate text-[10px] text-white/60">
              {currentUser?.roles?.map((role) => role.name).join(' | ') || 'No role assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <PermissionGate key={item.label} permission={item.permission}>
              <Link
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? `${item.bgActive} ${item.color}`
                    : 'text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
                  isActive ? `${item.bgActive}` : 'group-hover:bg-white/10'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className={cn('ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full', item.color.replace('text-', 'bg-'))} />
                )}
              </Link>
            </PermissionGate>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 px-3 py-4">
        <button
          type="button"
          onClick={async () => { await logoutAndRedirect(router); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition-all duration-200 hover:bg-red-500/15 hover:text-red-300"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg">
            <LogOut className="h-4 w-4" />
          </div>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
