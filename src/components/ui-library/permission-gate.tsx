'use client';

import type { ReactNode } from 'react';

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
    ? requiredPermissions.every((item) => permissions.includes(item))
    : requiredPermissions.some((item) => permissions.includes(item));

  return isAllowed ? <>{children}</> : <>{fallback}</>;
}
