'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-cream dark:bg-darkBg lg:grid lg:grid-cols-[280px_1fr]">
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>
      <div className="min-w-0">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="px-6 py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
