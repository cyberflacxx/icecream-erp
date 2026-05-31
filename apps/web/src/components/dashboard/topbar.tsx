'use client';

import { Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { NotificationBell } from '@absolute-ice-cream/ui';

import { useUserContext } from '@/contexts/UserContext';
import { logoutAndRedirect } from '@/lib/logout';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications
} from '@/hooks/useNotifications';

const pageTitles: Array<{ match: (path: string) => boolean; title: string }> = [
  { match: (path) => path.startsWith('/dashboard'), title: 'Dashboard' },
  { match: (path) => path.startsWith('/production'), title: 'Production' },
  { match: (path) => path.startsWith('/finance'), title: 'Finance' },
  { match: (path) => path.startsWith('/inventory'), title: 'Inventory' },
  { match: (path) => path.startsWith('/procurement'), title: 'Procurement' },
  { match: (path) => path.startsWith('/branches'), title: 'Branch Operations' },
  { match: (path) => path.startsWith('/reports'), title: 'Reports' },
  { match: (path) => path.startsWith('/settings'), title: 'Settings' }
];

interface TopbarProps {
  onOpenSidebar?: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useUserContext();
  const { data: notificationsData } = useNotifications(10);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pageTitle = useMemo(
    () => pageTitles.find((item) => item.match(pathname))?.title ?? 'Dashboard',
    [pathname],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-brown/10 bg-cream/90 px-4 py-4 backdrop-blur-xl dark:border-darkBorder dark:bg-darkBg/90 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-brown lg:hidden dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange">Authenticated workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-brown dark:text-darkText">
            {pageTitle}
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="hidden h-11 min-w-[240px] items-center gap-3 rounded-full border border-border bg-white px-4 text-sm text-muted shadow-sm md:flex dark:border-darkBorder dark:bg-darkCard dark:text-darkMuted">
            <Search className="h-4 w-4 text-orange" />
            <input
              type="search"
              placeholder="Search modules, reports, or branches"
              className="w-full bg-transparent text-brown outline-none placeholder:text-muted/80 dark:text-darkText dark:placeholder:text-darkMuted/80"
            />
          </label>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-brown dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <NotificationBell
            notifications={(notificationsData?.data ?? []).map((item) => ({
              id: item.id,
              isRead: item.isRead,
              link: item.link,
              message: item.message,
              title: item.title
            }))}
            onNotificationClick={(notificationId: string) => {
              markRead.mutate(notificationId);
              const target = (notificationsData?.data ?? []).find((item) => item.id === notificationId)?.link;
              if (target) {
                router.push(target);
              }
            }}
            onMarkAllRead={() => {
              markAllRead.mutate();
            }}
          />

          <div className="flex items-center gap-3 rounded-full border border-border bg-white px-3 py-2 shadow-sm dark:border-darkBorder dark:bg-darkCard">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-brown">
                {currentUser?.profile.fullName ?? 'ERP User'}
              </p>
              <p className="text-xs text-muted dark:text-darkMuted">
                {currentUser?.branch?.name ?? 'Factory-wide access'}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logoutAndRedirect(router);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-brown transition hover:bg-cream dark:border-darkBorder dark:text-darkText"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
