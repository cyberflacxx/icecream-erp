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
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition',
                isActive ? 'bg-brown text-white shadow-sm' : 'text-muted hover:bg-cream hover:text-brown',
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
