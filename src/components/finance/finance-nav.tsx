'use client';

import Link from 'next/link';
import {
  Banknote,
  BookOpenText,
  Building2,
  CalendarRange,
  ChartColumnIncreasing,
  ArrowLeftRight,
  FileBarChart2,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  ScrollText,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/finance', icon: ChartColumnIncreasing, label: 'Dashboard' },
  { href: '/finance/chart-of-accounts', icon: ScrollText, label: 'Accounts' },
  { href: '/finance/fiscal-periods', icon: CalendarRange, label: 'Periods' },
  { href: '/finance/journals', icon: BookOpenText, label: 'Journals' },
  { href: '/finance/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { href: '/finance/expenses', icon: FileBarChart2, label: 'Expenses' },
  { href: '/finance/bank-accounts', icon: Landmark, label: 'Bank Accounts' },
  { href: '/finance/cash-accounts', icon: Banknote, label: 'Cash Accounts' },
  { href: '/finance/petty-cash', icon: PiggyBank, label: 'Petty Cash' },
  { href: '/finance/budgets', icon: Building2, label: 'Budgets' },
  { href: '/finance/fixed-assets', icon: ReceiptText, label: 'Fixed Assets' },
  { href: '/finance/receivables', icon: Scale, label: 'Receivables' },
  { href: '/finance/payables', icon: Scale, label: 'Payables' },
  { href: '/finance/tax-codes', icon: ScrollText, label: 'Tax' },
  { href: '/finance/reports', icon: ChartColumnIncreasing, label: 'Reports' },
] as const;

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-1.5 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
                isActive ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)] shadow-sm' : 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
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
