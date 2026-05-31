export const BranchShiftStatus = {
  APPROVED: 'APPROVED',
  OPEN: 'OPEN',
  REJECTED: 'REJECTED',
  SUBMITTED: 'SUBMITTED'
} as const;

export type BranchShiftStatus = (typeof BranchShiftStatus)[keyof typeof BranchShiftStatus];

export const ShiftType = {
  DAY: 'DAY',
  NIGHT: 'NIGHT'
} as const;

export type ShiftType = (typeof ShiftType)[keyof typeof ShiftType];

export const PaymentMethod = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  CASH: 'CASH',
  CREDIT: 'CREDIT',
  ECOCASH: 'ECOCASH'
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const BranchStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  INACTIVE: 'INACTIVE'
} as const;

export type BranchStatus = (typeof BranchStatus)[keyof typeof BranchStatus];

export const shiftTypeValues = Object.values(ShiftType) as [ShiftType, ...ShiftType[]];
export const branchShiftStatusValues = Object.values(BranchShiftStatus) as [
  BranchShiftStatus,
  ...BranchShiftStatus[]
];
export const paymentMethodValues = Object.values(PaymentMethod) as [
  PaymentMethod,
  ...PaymentMethod[]
];
export const branchStatusValues = Object.values(BranchStatus) as [BranchStatus, ...BranchStatus[]];
