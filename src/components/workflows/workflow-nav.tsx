'use client';

import Link from 'next/link';
import { AlertOctagon, CheckSquare2, ClipboardList, GitCompareArrows, History, LayoutDashboard, Settings2, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/workflows', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/workflows/approvals', icon: ShieldCheck, label: 'My Approvals' },
  { href: '/workflows/history', icon: History, label: 'History' },
  { href: '/workflows/settings', icon: Settings2, label: 'Settings' },
  { href: '/workflows/posting-logs', icon: ClipboardList, label: 'Posting Logs' },
  { href: '/workflows/corrections', icon: CheckSquare2, label: 'Corrections' },
  { href: '/workflows/reversals', icon: GitCompareArrows, label: 'Reversals' },
  { href: '/workflows/voids', icon: AlertOctagon, label: 'Voids' },
] as const;

export function WorkflowNav() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition',
                isActive
                  ? 'bg-brown text-white shadow-sm dark:bg-darkBg dark:text-darkText'
                  : 'text-muted hover:bg-cream hover:text-brown dark:text-darkMuted dark:hover:bg-darkBg dark:hover:text-darkText',
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
