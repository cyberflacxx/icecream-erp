'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell } from 'lucide-react';

interface NotificationBellProps {
  notifications: Array<{
    id: string;
    link?: string;
    title: string;
    message: string;
    isRead?: boolean;
  }>;
  onMarkAllRead?: () => void;
  onNotificationClick?: (notificationId: string, link?: string) => void;
}

export function NotificationBell({
  notifications,
  onMarkAllRead,
  onNotificationClick
}: NotificationBellProps) {
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-brown dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={12}
          className="z-50 w-[340px] rounded-2xl border border-border bg-white p-2 shadow-xl dark:border-darkBorder dark:bg-darkCard"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-3 dark:border-darkBorder">
            <p className="text-sm font-semibold text-brown dark:text-darkText">Notifications</p>
            {onMarkAllRead ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-orange"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto py-2">
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted dark:text-darkMuted">No notifications yet.</div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenu.Item
                  key={notification.id}
                  className="cursor-pointer rounded-2xl px-3 py-3 outline-none transition hover:bg-cream dark:hover:bg-tableHoverDark"
                  onSelect={() => onNotificationClick?.(notification.id, notification.link)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-brown dark:text-darkText">{notification.title}</p>
                      {!notification.isRead ? <span className="h-2.5 w-2.5 rounded-full bg-orange" /> : null}
                    </div>
                    <p className="text-xs leading-5 text-muted dark:text-darkMuted">{notification.message}</p>
                  </div>
                </DropdownMenu.Item>
              ))
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
