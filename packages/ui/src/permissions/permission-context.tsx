'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

export interface PermissionContextValue {
  permissions: string[];
}

const PermissionContext = createContext<PermissionContextValue>({
  permissions: []
});

export function PermissionProvider({
  children,
  permissions
}: PermissionContextValue & { children: ReactNode }) {
  return (
    <PermissionContext.Provider value={{ permissions }}>{children}</PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
