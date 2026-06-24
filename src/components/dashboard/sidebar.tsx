'use client';

import Link from 'next/link';
import {
  BarChart3,
  ServerCog,
  Building2,
  DollarSign,
  Factory,
  FlaskConical,
  GitBranchPlus,
  LayoutDashboard,
  LogOut,
  Bell,
  ClipboardCheck,
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

import { cn } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';
import { hasAnyPermission, isSuperAdminPermissions, resolveDashboardPersona, type DashboardPersona } from '@/lib/dashboard-access';

import { useUserContext } from '@/contexts/UserContext';
import { logoutAndRedirect } from '@/lib/logout';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    permissions: [
      PERMISSIONS.dashboard.read,
      'sales.read',
      'procurement.read',
      'inventory.read',
      'production.read',
      'finance.read',
      'hr.read',
      'quality.read',
      'reports.read',
    ],
    personas: ['system_admin', 'branch_manager', 'operations_manager', 'production_manager', 'sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'hr_lead', 'quality_lead', 'operations_specialist'],
    color: 'text-orange',
    bgActive: 'bg-orange/15',
  },
  {
    href: '/procurement/suppliers',
    icon: Truck,
    label: 'Procurement',
    permissions: [PERMISSIONS.supplier.read, 'procurement.read'],
    personas: ['system_admin', 'procurement_lead', 'operations_manager'],
    color: 'text-amber-300',
    bgActive: 'bg-amber-500/15',
  },
  {
    href: '/inventory',
    icon: Warehouse,
    label: 'Inventory',
    permissions: [PERMISSIONS.inventory.read, 'inventory.read'],
    personas: ['system_admin', 'inventory_lead', 'production_manager', 'procurement_lead', 'branch_manager', 'operations_manager'],
    color: 'text-emerald-400',
    bgActive: 'bg-emerald-500/15',
  },
  {
    href: '/production',
    icon: Factory,
    label: 'Production',
    permissions: [PERMISSIONS.productionBatch.read, 'production.read'],
    personas: ['system_admin', 'production_manager', 'quality_lead', 'operations_manager'],
    color: 'text-orange-300',
    bgActive: 'bg-orange-500/15',
  },
  {
    href: '/branches',
    icon: Building2,
    label: 'Branch Ops',
    permissions: [PERMISSIONS.branchSales.read, 'branches.read', 'sales.read'],
    personas: ['system_admin', 'branch_manager', 'operations_manager'],
    color: 'text-rose-300',
    bgActive: 'bg-rose-500/15',
  },
  {
    href: '/sales',
    icon: ShoppingCart,
    label: 'Sales',
    permissions: [PERMISSIONS.branchSales.read, 'sales.read', PERMISSIONS.customer.read, PERMISSIONS.invoice.read],
    personas: ['system_admin', 'sales_lead', 'branch_manager', 'operations_manager'],
    color: 'text-yellow-400',
    bgActive: 'bg-yellow-500/15',
  },
  {
    href: '/finance',
    icon: Wallet,
    label: 'Finance',
    permissions: [PERMISSIONS.finance.read, 'finance.read', 'budget.read'],
    personas: ['system_admin', 'finance_lead'],
    color: 'text-teal-400',
    bgActive: 'bg-teal-500/15',
  },
  {
    href: '/hr',
    icon: UsersRound,
    label: 'HR & Payroll',
    permissions: ['hr.read', 'payroll.read'],
    personas: ['system_admin', 'hr_lead'],
    color: 'text-stone-300',
    bgActive: 'bg-stone-500/15',
  },
  {
    href: '/quality',
    icon: FlaskConical,
    label: 'Quality Control',
    permissions: ['quality.read', PERMISSIONS.productionQuality.read],
    personas: ['system_admin', 'quality_lead', 'production_manager', 'operations_manager'],
    color: 'text-lime-400',
    bgActive: 'bg-lime-500/15',
  },
  {
    href: '/cost-accounting',
    icon: DollarSign,
    label: 'Cost Accounting',
    permissions: [PERMISSIONS.finance.read, 'finance.read'],
    personas: ['system_admin', 'finance_lead'],
    color: 'text-amber-400',
    bgActive: 'bg-amber-500/15',
  },
  {
    href: '/maintenance',
    icon: Wrench,
    label: 'Maintenance',
    permissions: ['maintenance.read'],
    personas: ['system_admin', 'operations_manager'],
    color: 'text-orange-200',
    bgActive: 'bg-orange-400/15',
  },
  {
    href: '/budget',
    icon: Receipt,
    label: 'Budget',
    permissions: [PERMISSIONS.finance.read, 'budget.read', 'finance.read'],
    personas: ['system_admin', 'finance_lead'],
    color: 'text-teal-300',
    bgActive: 'bg-teal-500/15',
  },
  {
    href: '/reports',
    icon: BarChart3,
    label: 'Reports',
    permissions: [PERMISSIONS.reports.read, 'reports.read'],
    personas: ['system_admin', 'branch_manager', 'operations_manager', 'production_manager', 'sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'hr_lead', 'quality_lead', 'operations_specialist'],
    color: 'text-orange-400',
    bgActive: 'bg-orange-500/15',
  },
  {
    href: '/admin/migration',
    icon: ServerCog,
    label: 'Admin Ops',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
    color: 'text-orange-200',
    bgActive: 'bg-orange-500/15',
  },
  {
    href: '/notifications',
    icon: Bell,
    label: 'Notifications',
    permissions: [
      PERMISSIONS.dashboard.read,
      'sales.read',
      'procurement.read',
      'inventory.read',
      'production.read',
      'finance.read',
      'hr.read',
      'quality.read',
      'reports.read',
    ],
    personas: ['system_admin', 'branch_manager', 'operations_manager', 'production_manager', 'sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'hr_lead', 'quality_lead', 'operations_specialist'],
    color: 'text-rose-300',
    bgActive: 'bg-rose-500/15',
  },
  {
    href: '/testing',
    icon: ClipboardCheck,
    label: 'Testing & UAT',
    permissions: [PERMISSIONS.reports.read, 'testing.read', 'reports.read'],
    personas: ['system_admin'],
    color: 'text-green-300',
    bgActive: 'bg-green-500/15',
  },
  {
    href: '/workflows',
    icon: GitBranchPlus,
    label: 'Workflows',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
    color: 'text-fuchsia-400',
    bgActive: 'bg-fuchsia-500/15',
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Settings',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
    color: 'text-slate-400',
    bgActive: 'bg-slate-500/15',
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading } = useUserContext();
  const roleLabel =
    currentUser?.roles?.map((role) => role.name).join(' | ') ||
    currentUser?.profile?.role?.replace(/_/g, ' ') ||
    null;
  const permissions = currentUser?.permissions ?? [];
  const isSuperAdmin = isSuperAdminPermissions(permissions);
  const persona = resolveDashboardPersona({
    permissions,
    role: currentUser?.profile?.role,
    roleNames: currentUser?.roles?.map((role) => role.name) ?? [],
  });

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
              {isLoading ? 'Loading role...' : roleLabel ?? 'No role assigned'}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-orange/90"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Open dashboard
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isVisible =
            isSuperAdmin ||
            (hasAnyPermission(permissions, item.permissions) &&
              (item.personas as readonly DashboardPersona[]).includes(persona));

          if (!isVisible) {
            return null;
          }

          return (
            <Link
              key={item.label}
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
