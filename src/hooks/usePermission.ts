'use client';

import { useUserContext } from '@/contexts/UserContext';
import { hasPermissionAccess } from '@/lib/permission-access';

export function usePermission(permission: string | string[]) {
  const { permissions } = useUserContext();
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];

  return hasPermissionAccess(permissions, ...requiredPermissions);
}
