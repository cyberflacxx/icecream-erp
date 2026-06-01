'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-brown/10 shadow-[0_10px_30px_rgba(60,20,0,0.06)] transition-colors duration-300',
        isScrolled
          ? 'bg-white/72 backdrop-blur-xl supports-[backdrop-filter]:bg-white/68'
          : 'bg-white',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-brown sm:text-base">
          <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-orange/30 bg-white/55 shadow-sm backdrop-blur-md">
            <Image
              src="/branding/logo.png"
              alt="Absolute Ice Cream ERP Logo"
              fill
              sizes="40px"
              className="object-cover"
              priority
            />
          </span>
          <span>
            Absolute Ice Cream ERP
            <span className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-orange align-middle" />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative pb-1 text-sm font-medium text-brown transition-colors duration-200 hover:text-orange"
            >
              {link.label}
              <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-orange via-[#ffb15b] to-orange transition-transform duration-500 ease-out group-hover:scale-x-100" />
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
          'overflow-hidden border-t border-brown/10 bg-white transition-[max-height] duration-300 md:hidden',
          open ? 'max-h-72' : 'max-h-0 border-t-0',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative w-fit pb-1 text-sm font-medium text-brown transition-colors duration-200 hover:text-orange"
              onClick={() => setOpen(false)}
            >
              {link.label}
              <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-orange via-[#ffb15b] to-orange transition-transform duration-500 ease-out group-hover:scale-x-100" />
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
