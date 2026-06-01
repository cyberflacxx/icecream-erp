'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { UserContextProvider } from '@/contexts/UserContext';

interface ProvidersProps {
  children: ReactNode;
}

function MobileLightThemeGuard() {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 1024px)');
    const forceLightOnMobile = () => {
      if (media.matches) {
        setTheme('light');
      }
    };

    forceLightOnMobile();
    media.addEventListener('change', forceLightOnMobile);

    return () => {
      media.removeEventListener('change', forceLightOnMobile);
    };
  }, [setTheme]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 60_000
          }
        }
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MobileLightThemeGuard />
      <QueryClientProvider client={queryClient}>
        <UserContextProvider>{children}</UserContextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
