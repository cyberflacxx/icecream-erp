'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { EmptyState } from '@/components/ui-library';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { useUserContext } from '@/contexts/UserContext';
import { canAccessDashboardPath, resolveDashboardPersona } from '@/lib/dashboard-access';
import { AlertCircle } from 'lucide-react';

function DashboardFooter() {
  return (
    <footer className="border-t border-[color:var(--app-border-muted)] px-3 py-3 text-xs text-[color:var(--app-muted)] sm:px-4 lg:px-5">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <span>© {new Date().getFullYear()} Absolute Icecreams</span>
        <span>cyberflacx_productions</span>
      </div>
    </footer>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading } = useUserContext();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoading || !currentUser) return;
    const persona = resolveDashboardPersona({
      permissions: currentUser.permissions,
      role: currentUser.profile.role,
      roleNames: currentUser.roles.map((role) => role.name),
    });
    if (!canAccessDashboardPath(persona, pathname)) {
      router.replace('/dashboard');
    }
  }, [currentUser, isLoading, pathname, router]);

  if (!isLoading && currentUser) {
    const persona = resolveDashboardPersona({
      permissions: currentUser.permissions,
      role: currentUser.profile.role,
      roleNames: currentUser.roles.map((role) => role.name),
    });

    if (!canAccessDashboardPath(persona, pathname)) {
      return (
        <div className="min-h-screen bg-[var(--app-bg-canvas)] lg:grid lg:grid-cols-[272px_1fr]">
          <Sidebar />
          <div className="min-w-0 border-l border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)]">
            <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
              <div className="mx-auto max-w-[1440px]">
                <EmptyState
                  icon={<AlertCircle className="h-6 w-6" />}
                  title="Access restricted"
                  description="This role does not have access to the selected module."
                />
              </div>
            </main>
            <DashboardFooter />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg-canvas)] lg:grid lg:grid-cols-[272px_1fr]">
      <div
        className={`fixed inset-0 z-40 bg-[rgba(15,23,42,0.45)] backdrop-blur-sm transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[272px] transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>
      <div className="min-w-0 border-l border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)]">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}
