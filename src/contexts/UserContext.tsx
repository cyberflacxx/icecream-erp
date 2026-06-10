'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { PermissionProvider } from '@/components/ui-library';

import { createClient, hasSupabaseClientEnv } from '@/lib/supabase/client';
import { useCurrentUser, type CurrentUser } from '@/hooks/useCurrentUser';

interface UserContextValue {
  currentUser: CurrentUser | null;
  isLoading: boolean;
  permissions: string[];
  refreshUser: () => Promise<unknown>;
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  isLoading: false,
  permissions: [],
  refreshUser: async () => null,
});

function AuthenticatedUserProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data ?? null;
  const permissions = currentUser?.permissions ?? [];

  const protectedPrefixes = [
    '/dashboard',
    '/procurement',
    '/inventory',
    '/production',
    '/branches',
    '/reports',
    '/settings',
    '/finance',
    '/sales',
  ];
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Listen for Supabase auth state changes to invalidate user cache on logout/login
  useEffect(() => {
    if (!hasSupabaseClientEnv()) {
      return;
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        queryClient.removeQueries({ queryKey: ['current-user'] });
        router.replace('/auth/login');
      }
      if (event === 'SIGNED_IN') {
        queryClient.invalidateQueries({ queryKey: ['current-user'] });
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  // Redirect on auth error from a protected route
  useEffect(() => {
    if (!isProtectedRoute || currentUserQuery.isLoading || !currentUserQuery.isError) {
      return;
    }

    const message = currentUserQuery.error?.message?.toLowerCase() ?? '';
    const isAuthError =
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('token') ||
      message.includes('session');

    if (isAuthError) {
      router.replace('/auth/login');
    }
  }, [currentUserQuery.error?.message, currentUserQuery.isError, currentUserQuery.isLoading, isProtectedRoute, router]);

  return (
    <PermissionProvider permissions={permissions}>
      <UserContext.Provider
        value={{
          currentUser,
          isLoading: currentUserQuery.isLoading,
          permissions,
          refreshUser: currentUserQuery.refetch,
        }}
      >
        {children}
      </UserContext.Provider>
    </PermissionProvider>
  );
}

export function UserContextProvider({ children }: { children: ReactNode }) {
  return <AuthenticatedUserProvider>{children}</AuthenticatedUserProvider>;
}

export function useUserContext() {
  return useContext(UserContext);
}
