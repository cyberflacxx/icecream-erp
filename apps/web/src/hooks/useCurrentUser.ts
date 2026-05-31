'use client';

import { useAppAuth } from '@/hooks/useAppAuth';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { apiFetch } from '@/lib/api';

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
  };
  rawPermissions: string[];
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
  }>;
}

async function fetchCurrentUser(getToken: () => Promise<string | null>) {
  const token = await getToken();

  return apiFetch<CurrentUser>('/api/auth/me', {
    token
  });
}

export function useCurrentUser() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
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
    queryFn: () => fetchCurrentUser(getToken),
    enabled: requiresAuth && isLoaded && Boolean(isSignedIn),
    retry: false
  });
}


