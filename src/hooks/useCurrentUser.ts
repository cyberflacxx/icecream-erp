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
  const response = await fetch('/api/auth/profile', { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<CurrentUser>;
}

export function useCurrentUser() {
  const { isLoaded, isSignedIn, userId } = useAppAuth();
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
    pathname.startsWith('/sales');

  return useQuery({
    queryKey: ['current-user', userId],
    queryFn: fetchCurrentUser,
    enabled: requiresAuth && isLoaded && isSignedIn,
    retry: false,
  });
}
