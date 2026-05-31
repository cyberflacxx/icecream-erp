export const SupplierStatus = {
  ACTIVE: 'ACTIVE',
  BLACKLISTED: 'BLACKLISTED',
  INACTIVE: 'INACTIVE'
} as const;

export type SupplierStatus = (typeof SupplierStatus)[keyof typeof SupplierStatus];

export const SupplierBalanceUpdateType = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT'
} as const;

export type SupplierBalanceUpdateType =
  (typeof SupplierBalanceUpdateType)[keyof typeof SupplierBalanceUpdateType];

export const supplierStatusValues = Object.values(SupplierStatus) as [
  SupplierStatus,
  ...SupplierStatus[]
];
export const supplierBalanceUpdateTypeValues = Object.values(SupplierBalanceUpdateType) as [
  SupplierBalanceUpdateType,
  ...SupplierBalanceUpdateType[]
];
