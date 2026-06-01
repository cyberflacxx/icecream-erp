import type { ERP_MODULES, USER_ROLES } from '../constants/app';

export type AppModule = (typeof ERP_MODULES)[number];
export type UserRoleKey = (typeof USER_ROLES)[number];

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export * from './service-types';
