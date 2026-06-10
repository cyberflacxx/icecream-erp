'use client';

import { Camera, LogOut, Menu, Moon, Search, Settings, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { NotificationBell } from '@/components/ui-library';

import { useUserContext } from '@/contexts/UserContext';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
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
  { match: (path) => path.startsWith('/sales'), title: 'Sales' },
  { match: (path) => path.startsWith('/hr'), title: 'HR & Payroll' },
  { match: (path) => path.startsWith('/quality'), title: 'Quality Control' },
  { match: (path) => path.startsWith('/cost-accounting'), title: 'Cost Accounting' },
  { match: (path) => path.startsWith('/maintenance'), title: 'Maintenance' },
  { match: (path) => path.startsWith('/budget'), title: 'Budgeting & Variance' },
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pageTitle = useMemo(
    () => pageTitles.find((item) => item.match(pathname))?.title ?? 'Dashboard',
    [pathname],
  );

  useEffect(() => { setMounted(true); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = (currentUser?.profile?.fullName ?? 'E')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const { avatarUrl, uploading, inputRef, openPicker, handleFileChange } = useAvatarUpload();

  return (
    <header className="sticky top-0 z-20 border-b border-brown/10 bg-cream/95 backdrop-blur-xl dark:border-white/8 dark:bg-[#0D0500]/95 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={onOpenSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brown/15 bg-brown/5 text-brown dark:border-white/10 dark:bg-white/5 dark:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brown/40 dark:text-white/30">Manufacturing ERP</p>
            <h2 className="text-base font-bold text-brown dark:text-white">{pageTitle}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="hidden h-9 min-w-[200px] items-center gap-2 rounded-lg border border-brown/15 bg-brown/5 px-3 text-sm text-brown/40 dark:border-white/10 dark:bg-white/5 dark:text-white/40 md:flex">
            <Search className="h-4 w-4 flex-shrink-0" />
            <input
              type="search"
              placeholder="Search..."
              className="w-full bg-transparent text-brown outline-none placeholder:text-brown/30 dark:text-white dark:placeholder:text-white/30"
            />
          </label>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-brown/15 bg-brown/5 text-brown/60 transition hover:bg-brown/10 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
              if (target) router.push(target);
            }}
            onMarkAllRead={() => { markAllRead.mutate(); }}
          />

          {/* User avatar + dropdown */}
          <div className="relative" ref={dropdownRef}>
            {/* Hidden file input for avatar upload */}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label="Upload profile photo"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-brown/15 bg-brown/5 px-2.5 py-1.5 transition hover:bg-brown/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-brown dark:text-white">{currentUser?.profile?.fullName ?? 'ERP User'}</p>
                <p className="text-[10px] text-brown/40 dark:text-white/40">{currentUser?.roles?.[0]?.name ?? 'Staff'}</p>
              </div>
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-orange text-white text-xs font-bold shadow-glow-sm overflow-hidden">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                ) : (
                  initials
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-brown/10 bg-white shadow-card-hover dark:border-white/10 dark:bg-[#1a0800]">
                <div className="border-b border-brown/8 px-4 py-3 dark:border-white/8">
                  <p className="text-xs font-semibold text-brown dark:text-white">{currentUser?.profile?.fullName ?? 'ERP User'}</p>
                  <p className="text-[10px] text-brown/50 dark:text-white/40">{currentUser?.profile?.email ?? ''}</p>
                </div>
                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); openPicker(); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brown/70 transition hover:bg-brown/5 hover:text-brown dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <Camera className="h-4 w-4" />
                    Upload Photo
                  </button>
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-brown/70 transition hover:bg-brown/5 hover:text-brown dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <Link
                    href="/settings/users"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-brown/70 transition hover:bg-brown/5 hover:text-brown dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                </div>
                <div className="border-t border-brown/8 py-1.5 dark:border-white/8">
                  <button
                    type="button"
                    onClick={async () => { setDropdownOpen(false); await logoutAndRedirect(router); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
