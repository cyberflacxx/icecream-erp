'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3,
  Bell,
  Building2,
  Bot,
  ClipboardCheck,
  DollarSign,
  Factory,
  FlaskConical,
  GitBranchPlus,
  LayoutDashboard,
  LogOut,
  Receipt,
  ServerCog,
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
import { useUserContext } from '@/contexts/UserContext';
import { hasAnyPermission, isSuperAdminPermissions, resolveDashboardPersona, type DashboardPersona } from '@/lib/dashboard-access';
import { logoutAndRedirect } from '@/lib/logout';
import { PERMISSIONS } from '@/lib/shared';

type NavSection = 'Dashboard' | 'Operations' | 'Finance' | 'Reports' | 'Administration';

const navSections: NavSection[] = ['Dashboard', 'Operations', 'Finance', 'Reports', 'Administration'];

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    section: 'Dashboard',
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
  },
  {
    href: '/ai',
    icon: Bot,
    label: 'Absolute AI',
    section: 'Dashboard',
    permissions: [
      PERMISSIONS.dashboard.read,
      PERMISSIONS.inventory.read,
      PERMISSIONS.finance.read,
      PERMISSIONS.reports.read,
      'sales.read',
      'procurement.read',
      'audit_log.read',
    ],
    personas: ['system_admin', 'branch_manager', 'operations_manager', 'production_manager', 'sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'quality_lead', 'operations_specialist'],
  },
  {
    href: '/notifications',
    icon: Bell,
    label: 'Notifications',
    section: 'Dashboard',
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
  },
  {
    href: '/reports',
    icon: BarChart3,
    label: 'Reports',
    section: 'Reports',
    permissions: [PERMISSIONS.reports.read, 'reports.read'],
    personas: ['system_admin', 'branch_manager', 'operations_manager', 'production_manager', 'sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'hr_lead', 'quality_lead', 'operations_specialist'],
  },
  {
    href: '/procurement/suppliers',
    icon: Truck,
    label: 'Procurement',
    section: 'Operations',
    permissions: [PERMISSIONS.supplier.read, 'procurement.read'],
    personas: ['system_admin', 'procurement_lead', 'operations_manager'],
  },
  {
    href: '/inventory',
    icon: Warehouse,
    label: 'Inventory',
    section: 'Operations',
    permissions: [PERMISSIONS.inventory.read, 'inventory.read'],
    personas: ['system_admin', 'inventory_lead', 'production_manager', 'procurement_lead', 'branch_manager', 'operations_manager'],
  },
  {
    href: '/production',
    icon: Factory,
    label: 'Production',
    section: 'Operations',
    permissions: [PERMISSIONS.productionBatch.read, 'production.read'],
    personas: ['system_admin', 'production_manager', 'quality_lead', 'operations_manager'],
  },
  {
    href: '/branches',
    icon: Building2,
    label: 'Branch Ops',
    section: 'Operations',
    permissions: [PERMISSIONS.branchSales.read, 'branches.read', 'sales.read'],
    personas: ['system_admin', 'branch_manager', 'operations_manager'],
  },
  {
    href: '/sales',
    icon: ShoppingCart,
    label: 'Sales',
    section: 'Operations',
    permissions: [PERMISSIONS.branchSales.read, 'sales.read', PERMISSIONS.customer.read, PERMISSIONS.invoice.read],
    personas: ['system_admin', 'sales_lead', 'branch_manager', 'operations_manager'],
  },
  {
    href: '/maintenance',
    icon: Wrench,
    label: 'Maintenance',
    section: 'Operations',
    permissions: ['maintenance.read'],
    personas: ['system_admin', 'operations_manager'],
  },
  {
    href: '/finance',
    icon: Wallet,
    label: 'Finance',
    section: 'Finance',
    permissions: [PERMISSIONS.finance.read, 'finance.read', 'budget.read'],
    personas: ['system_admin', 'finance_lead'],
  },
  {
    href: '/cost-accounting',
    icon: DollarSign,
    label: 'Cost Accounting',
    section: 'Finance',
    permissions: [PERMISSIONS.finance.read, 'finance.read'],
    personas: ['system_admin', 'finance_lead'],
  },
  {
    href: '/budget',
    icon: Receipt,
    label: 'Budget',
    section: 'Finance',
    permissions: [PERMISSIONS.finance.read, 'budget.read', 'finance.read'],
    personas: ['system_admin', 'finance_lead'],
  },
  {
    href: '/hr',
    icon: UsersRound,
    label: 'HR & Payroll',
    section: 'Administration',
    permissions: ['hr.read', 'payroll.read'],
    personas: ['system_admin', 'hr_lead'],
  },
  {
    href: '/quality',
    icon: FlaskConical,
    label: 'Quality Control',
    section: 'Operations',
    permissions: ['quality.read', PERMISSIONS.productionQuality.read],
    personas: ['system_admin', 'quality_lead', 'production_manager', 'operations_manager'],
  },
  {
    href: '/admin/migration',
    icon: ServerCog,
    label: 'Admin Ops',
    section: 'Administration',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
  },
  {
    href: '/testing',
    icon: ClipboardCheck,
    label: 'Testing & UAT',
    section: 'Administration',
    permissions: [PERMISSIONS.reports.read, 'testing.read', 'reports.read'],
    personas: ['system_admin'],
  },
  {
    href: '/workflows',
    icon: GitBranchPlus,
    label: 'Workflows',
    section: 'Administration',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Settings',
    section: 'Administration',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
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

  const visibleItems = navItems.filter((item) => (
    isSuperAdmin ||
    (hasAnyPermission(permissions, item.permissions) &&
      (item.personas as readonly DashboardPersona[]).includes(persona))
  ));

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-900/10 bg-[linear-gradient(180deg,#0f2c52_0%,#173b6e_58%,#214f8a_100%)] text-white backdrop-blur-xl dark:border-[color:var(--app-border-muted)] dark:bg-[color:var(--app-sidebar)] dark:text-[color:var(--app-text)]">
      <div className="border-b border-white/12 px-4 py-4 dark:border-[color:var(--app-border-muted)]">
        <div className="rounded-[26px] border border-white/12 bg-white/10 px-4 py-4 shadow-[0_16px_36px_rgba(2,6,23,0.18)] dark:app-panel-subtle dark:shadow-none">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/18 bg-white shadow-[var(--app-shadow-sm)] dark:border-[color:var(--app-border)] dark:bg-[color:var(--app-bg-canvas)]">
              <Image
                src="/branding/logo.png"
                alt="Absolute Ice Cream ERP"
                width={44}
                height={44}
                className="h-11 w-11 scale-110 object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[-0.02em] text-white dark:text-[color:var(--app-text)]">
                Absolute Ice Cream ERP
              </p>
              <p className="mt-0.5 text-xs leading-5 text-blue-100/78 dark:text-[color:var(--app-muted)]">
                Internal operations console
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-slate-950/18 px-4 py-3.5 backdrop-blur-sm dark:border-[color:var(--app-border-muted)] dark:bg-[color:var(--app-bg-default)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-100/62 dark:text-[color:var(--app-subtle)]">
              Signed in as
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-white dark:text-[color:var(--app-text)]">
              {currentUser?.profile?.fullName ?? 'ERP User'}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-blue-100/76 dark:text-[color:var(--app-muted)]">
              <span className="h-2 w-2 rounded-full bg-emerald-300 dark:bg-[color:var(--app-accent)]" />
              <span className="truncate">
                {isLoading ? 'Loading role...' : roleLabel ?? 'No role assigned'}
              </span>
            </div>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/16 bg-white px-3 py-2 text-[11px] font-semibold text-slate-900 transition hover:bg-blue-50 dark:border-[color:var(--app-border)] dark:bg-[color:var(--app-bg-subtle)] dark:text-[color:var(--app-text)] dark:hover:border-[color:var(--app-border-strong)] dark:hover:bg-[color:var(--app-surface)]"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-[color:var(--app-accent-strong)] dark:text-[color:var(--app-accent)]" />
              Open dashboard
            </Link>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map((section) => {
            const sectionItems = visibleItems.filter((item) => item.section === section);

            if (sectionItems.length === 0) {
              return null;
            }

            return (
              <section key={section}>
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100/60 dark:text-[color:var(--app-subtle)]">
                  {section}
                </p>
                <div className="mt-2 space-y-1.5">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 transition-all duration-150',
                          isActive
                            ? 'border border-white/20 bg-white text-slate-900 shadow-[0_10px_24px_rgba(2,6,23,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-accent-soft)] dark:text-[color:var(--app-accent-strong)] dark:shadow-[var(--app-shadow-sm)]'
                            : 'border border-transparent text-blue-50/84 hover:border-white/12 hover:bg-white/10 hover:text-white dark:text-[color:var(--app-muted)] dark:hover:border-[color:var(--app-border-muted)] dark:hover:bg-[color:var(--app-bg-subtle)] dark:hover:text-[color:var(--app-text)]',
                        )}
                        title={item.label}
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition',
                            isActive
                              ? 'border-slate-200 bg-slate-50 text-[color:var(--app-accent-strong)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-bg-canvas)] dark:text-[color:var(--app-accent)]'
                              : 'border-white/12 bg-slate-950/18 text-blue-100/74 group-hover:border-white/18 group-hover:bg-white/12 group-hover:text-white dark:border-[color:var(--app-border-muted)] dark:bg-[color:var(--app-bg-default)] dark:text-[color:var(--app-subtle)] dark:group-hover:text-[color:var(--app-accent)]',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                        {isActive ? <span className="ml-auto h-2 w-2 rounded-full bg-[color:var(--app-accent-strong)] dark:bg-[color:var(--app-accent)]" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/12 px-3 py-4 dark:border-[color:var(--app-border-muted)]">
        <button
          type="button"
          onClick={async () => { await logoutAndRedirect(router); }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-700/70">
            <LogOut className="h-4 w-4" />
          </div>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
