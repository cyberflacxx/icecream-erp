'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { PermissionProvider } from '@absolute-ice-cream/ui';

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
  refreshUser: async () => null
});

function AuthenticatedUserProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
    '/sales'
  ];
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

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
          refreshUser: currentUserQuery.refetch
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
