'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#modules', label: 'Modules' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#faq', label: 'FAQ' }
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-brown/10 bg-cream/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-brown sm:text-base">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange text-white shadow-sm">
            A
          </span>
          <span>
            Absolute Ice Cream ERP
            <span className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-orange align-middle" />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-muted transition hover:text-brown">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button asChild>
            <Link href="/auth/login" prefetch={false}>
              Login to Dashboard
            </Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-brown md:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden border-t border-brown/10 bg-cream transition-[max-height] duration-300 md:hidden',
          open ? 'max-h-72' : 'max-h-0 border-t-0',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Button asChild className="w-full">
            <Link href="/auth/login" prefetch={false} onClick={() => setOpen(false)}>
              Login to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
