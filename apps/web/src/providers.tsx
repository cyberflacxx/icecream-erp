'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { UserContextProvider } from '@/contexts/UserContext';

interface ProvidersProps {
  children: ReactNode;
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
      <QueryClientProvider client={queryClient}>
        <UserContextProvider>{children}</UserContextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
