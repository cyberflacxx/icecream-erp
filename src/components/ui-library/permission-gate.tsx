'use client';

import type { ReactNode } from 'react';

import { hasPermissionAccess } from '@/lib/permission-access';

import { usePermissions } from './permissions/permission-context';

export interface PermissionGateProps {
  permission: string | string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  requireAll = false,
  fallback = null,
  children
}: PermissionGateProps) {
  const { permissions } = usePermissions();
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  const isAllowed = requireAll
    ? requiredPermissions.every((item) => hasPermissionAccess(permissions, item))
    : hasPermissionAccess(permissions, ...requiredPermissions);

  return isAllowed ? <>{children}</> : <>{fallback}</>;
}
