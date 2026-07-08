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
  { match: (path) => path.startsWith('/testing'), title: 'Testing, UAT & Handover' },
  { match: (path) => path.startsWith('/workflows'), title: 'Workflow Control' },
  { match: (path) => path.startsWith('/notifications'), title: 'Notifications' },
  { match: (path) => path.startsWith('/admin'), title: 'Deployment Readiness' },
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
    <header className="sticky top-0 z-20 border-b border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)] px-3 py-2.5 backdrop-blur-xl sm:px-4 lg:px-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={onOpenSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)] text-[color:var(--app-text)] lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-subtle)]">
                RoboCore-style workspace
              </p>
              <span className="hidden rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-muted)] sm:inline-flex">
                Live workspace
              </span>
            </div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[color:var(--app-text)] sm:text-lg">
              {pageTitle}
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)] px-3 py-2 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-border-strong)] md:inline-flex"
          >
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <label className="hidden h-9 min-w-[220px] items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)] px-3 text-sm text-[color:var(--app-muted)] md:flex">
            <Search className="h-4 w-4 flex-shrink-0" />
            <input
              type="search"
              placeholder="Search modules, records, people..."
              className="w-full bg-transparent text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-subtle)]"
            />
          </label>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)] px-3 text-sm font-medium text-[color:var(--app-text)] transition hover:border-[color:var(--app-border-strong)]"
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? <Sun className="h-4 w-4 text-[color:var(--app-accent)]" /> : <Moon className="h-4 w-4 text-[color:var(--app-accent)]" />}
            <span className="hidden sm:inline">{mounted && theme === 'dark' ? 'Day mode' : 'Night mode'}</span>
          </button>

          <NotificationBell
            notifications={(notificationsData?.data ?? []).map((item) => ({
              id: item.id,
              isRead: item.isRead,
              link: item.link,
              message: item.message,
              module: item.module,
              severity: item.severity,
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
              className="flex items-center gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)] px-2.5 py-1.5 transition hover:border-[color:var(--app-border-strong)]"
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-[color:var(--app-text)]">{currentUser?.profile?.fullName ?? 'ERP User'}</p>
                <p className="text-[10px] text-[color:var(--app-subtle)]">{currentUser?.roles?.[0]?.name ?? 'Staff'}</p>
              </div>
              <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-accent-strong)] text-xs font-bold text-white">
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
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[var(--app-shadow-lg)]">
                <div className="border-b border-[color:var(--app-border-muted)] px-4 py-3">
                  <p className="text-xs font-semibold text-[color:var(--app-text)]">{currentUser?.profile?.fullName ?? 'ERP User'}</p>
                  <p className="text-[10px] text-[color:var(--app-subtle)]">{currentUser?.profile?.email ?? ''}</p>
                </div>
                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); openPicker(); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]"
                  >
                    <Camera className="h-4 w-4" />
                    Upload Photo
                  </button>
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <Link
                    href="/settings/users"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]"
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                </div>
                <div className="border-t border-[color:var(--app-border-muted)] py-1.5">
                  <button
                    type="button"
                    onClick={async () => { setDropdownOpen(false); await logoutAndRedirect(router); }}
                    className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
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
