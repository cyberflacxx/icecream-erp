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
        <div className="min-h-screen bg-cream dark:bg-[#0D0500] lg:grid lg:grid-cols-[260px_1fr]">
          <Sidebar />
          <div className="min-w-0 bg-[#f5f0e8] dark:bg-[#0F0703]">
            <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="px-5 py-6">
              <div className="mx-auto max-w-7xl">
                <EmptyState
                  icon={<AlertCircle className="h-6 w-6" />}
                  title="Access restricted"
                  description="This role does not have access to the selected module."
                />
              </div>
            </main>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0D0500] lg:grid lg:grid-cols-[260px_1fr]">
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>
      <div className="min-w-0 bg-[#f5f0e8] dark:bg-[#0F0703]">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="px-5 py-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
