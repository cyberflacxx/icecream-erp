import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';

import { Providers } from '@/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Absolute Ice Cream ERP',
  description:
    "Manufacturing ERP for Zimbabwe's ice cream industry, from procurement to production, branches, and sales."
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
