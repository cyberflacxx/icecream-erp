'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

export interface CurrentUser {
  branch: {
    id: string;
    code: string;
    name: string;
  } | null;
  clerkUserId: string;
  isBranchScoped: boolean;
  organizationId: string;
  permissions: string[];
  profile: {
    id: string;
    clerkUserId: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    branchId: string | null;
    workId?: string;
    status: string;
    role: string;
  };
  rawPermissions: string[];
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
  }>;
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<CurrentUser>;
}

export function useCurrentUser() {
  const { isLoaded, userId } = useAppAuth();
  const pathname = usePathname();

  const requiresAuth =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/procurement') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/production') ||
    pathname.startsWith('/branches') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/sales') ||
    pathname.startsWith('/quality');

  return useQuery({
    queryKey: ['current-user', userId],
    queryFn: fetchCurrentUser,
    // Rely on the server auth cookie on protected routes so role/profile loading
    // still works immediately after server-side login, even before the browser
    // Supabase client has refreshed its local session state.
    enabled: requiresAuth && isLoaded,
    retry: false,
  });
}
