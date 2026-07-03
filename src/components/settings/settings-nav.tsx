'use client';

import Link from 'next/link';
import { Building2, Clock3, FileDown, FileUp, FolderKanban, KeyRound, Package2, ScrollText, Settings2, Shield, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/settings', icon: Building2, label: 'Overview' },
  { href: '/settings/master-data', icon: FolderKanban, label: 'Master Data' },
  { href: '/settings/products', icon: Package2, label: 'Products' },
  { href: '/settings/finance-setup', icon: Settings2, label: 'Finance Setup' },
  { href: '/settings/import-export', icon: FileUp, label: 'Import / Export' },
  { href: '/settings/users', icon: Users, label: 'Users' },
  { href: '/settings/roles', icon: Shield, label: 'Roles' },
  { href: '/settings/permissions', icon: KeyRound, label: 'Permissions' },
  { href: '/settings/access', icon: UserCheck, label: 'Access' },
  { href: '/settings/approvals', icon: ShieldCheck, label: 'Approvals' },
  { href: '/settings/sessions', icon: Clock3, label: 'Sessions' },
  { href: '/settings/security-events', icon: ShieldCheck, label: 'Security Events' },
  { href: '/settings/audit-logs', icon: ScrollText, label: 'Audit Logs' },
  { href: '/settings/export-history', icon: FileDown, label: 'Export History' },
  { href: '/settings/security-settings', icon: Building2, label: 'Security Settings' }
] as const;

export function SettingsNav() {
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
