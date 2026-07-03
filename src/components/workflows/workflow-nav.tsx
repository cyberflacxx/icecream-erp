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
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
                isActive
                  ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)] shadow-sm'
                  : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
