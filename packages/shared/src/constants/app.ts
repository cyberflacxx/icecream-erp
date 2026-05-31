export const APP_NAME = 'Absolute Ice Cream ERP';

export const USER_ROLES = [
  'super_admin',
  'general_manager',
  'procurement_officer',
  'store_controller',
  'production_manager',
  'quality_assurance',
  'branch_manager',
  'cashier',
  'finance_officer'
] as const;

export const ERP_MODULES = [
  'dashboard',
  'procurement',
  'inventory',
  'production',
  'branch_operations',
  'sales',
  'finance',
  'hr_payroll',
  'reports',
  'settings'
] as const;
