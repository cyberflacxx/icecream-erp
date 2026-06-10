'use client';

import { useUserContext } from '@/contexts/UserContext';

export function usePermission(permission: string | string[]) {
  const { permissions } = useUserContext();
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];

  return requiredPermissions.some((item) => permissions.includes(item));
}
