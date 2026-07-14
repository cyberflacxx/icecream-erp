'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3,
  Bell,
  Building2,
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

type NavSection = 'Overview' | 'Operations' | 'Control' | 'Platform';

const navSections: NavSection[] = ['Overview', 'Operations', 'Control', 'Platform'];

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    section: 'Overview',
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
    href: '/notifications',
    icon: Bell,
    label: 'Notifications',
    section: 'Overview',
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
    section: 'Overview',
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
    section: 'Control',
    permissions: [PERMISSIONS.finance.read, 'finance.read', 'budget.read'],
    personas: ['system_admin', 'finance_lead'],
  },
  {
    href: '/cost-accounting',
    icon: DollarSign,
    label: 'Cost Accounting',
    section: 'Control',
    permissions: [PERMISSIONS.finance.read, 'finance.read'],
    personas: ['system_admin', 'finance_lead'],
  },
  {
    href: '/budget',
    icon: Receipt,
    label: 'Budget',
    section: 'Control',
    permissions: [PERMISSIONS.finance.read, 'budget.read', 'finance.read'],
    personas: ['system_admin', 'finance_lead'],
  },
  {
    href: '/hr',
    icon: UsersRound,
    label: 'HR & Payroll',
    section: 'Control',
    permissions: ['hr.read', 'payroll.read'],
    personas: ['system_admin', 'hr_lead'],
  },
  {
    href: '/quality',
    icon: FlaskConical,
    label: 'Quality Control',
    section: 'Control',
    permissions: ['quality.read', PERMISSIONS.productionQuality.read],
    personas: ['system_admin', 'quality_lead', 'production_manager', 'operations_manager'],
  },
  {
    href: '/admin/migration',
    icon: ServerCog,
    label: 'Admin Ops',
    section: 'Platform',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
  },
  {
    href: '/testing',
    icon: ClipboardCheck,
    label: 'Testing & UAT',
    section: 'Platform',
    permissions: [PERMISSIONS.reports.read, 'testing.read', 'reports.read'],
    personas: ['system_admin'],
  },
  {
    href: '/workflows',
    icon: GitBranchPlus,
    label: 'Workflows',
    section: 'Platform',
    permissions: [PERMISSIONS.settings.manage, 'manage_roles'],
    personas: ['system_admin'],
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Settings',
    section: 'Platform',
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
    <aside className="flex h-full flex-col overflow-hidden border-r border-[color:var(--app-border-muted)] bg-[color:var(--app-sidebar)] backdrop-blur-xl">
      <div className="border-b border-[color:var(--app-border-muted)] px-3 py-3">
        <div className="app-panel-subtle px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)] shadow-[var(--app-shadow-sm)]">
              <Image
                src="/branding/logo.png"
                alt="Absolute Ice Cream ERP"
                width={44}
                height={44}
                className="h-11 w-11 scale-110 object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[color:var(--app-text)]">
                Absolute Ice Cream ERP
              </p>
              <p className="text-[11px] text-[color:var(--app-muted)]">
                Internal operations console
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-subtle)]">
              Signed in as
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-[color:var(--app-text)]">
              {currentUser?.profile?.fullName ?? 'ERP User'}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[color:var(--app-muted)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--app-accent)]" />
              <span className="truncate">
                {isLoading ? 'Loading role...' : roleLabel ?? 'No role assigned'}
              </span>
            </div>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-border-strong)] hover:bg-[color:var(--app-surface)]"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
              Open dashboard
            </Link>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-4">
          {navSections.map((section) => {
            const sectionItems = visibleItems.filter((item) => item.section === section);

            if (sectionItems.length === 0) {
              return null;
            }

            return (
              <section key={section}>
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-subtle)]">
                  {section}
                </p>
                <div className="mt-1.5 space-y-1">
                  {sectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150',
                          isActive
                            ? 'border border-[color:var(--app-border-strong)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)] shadow-[var(--app-shadow-sm)]'
                            : 'border border-transparent text-[color:var(--app-muted)] hover:border-[color:var(--app-border-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition',
                            isActive
                              ? 'border-[color:var(--app-border-strong)] bg-[color:var(--app-bg-canvas)] text-[color:var(--app-accent)]'
                              : 'border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)] text-[color:var(--app-subtle)] group-hover:text-[color:var(--app-accent)]',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate font-medium">{item.label}</span>
                        {isActive ? <span className="ml-auto h-2 w-2 rounded-full bg-[color:var(--app-accent)]" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[color:var(--app-border-muted)] px-2.5 py-3">
        <button
          type="button"
          onClick={async () => { await logoutAndRedirect(router); }}
          className="flex w-full items-center gap-3 rounded-lg bg-red-600 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-700/70">
            <LogOut className="h-4 w-4" />
          </div>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
