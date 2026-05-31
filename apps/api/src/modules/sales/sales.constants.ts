export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  BLACKLISTED: 'BLACKLISTED',
  INACTIVE: 'INACTIVE'
} as const;

export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const QuotationStatus = {
  ACCEPTED: 'ACCEPTED',
  CANCELLED: 'CANCELLED',
  DRAFT: 'DRAFT',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
  SENT: 'SENT'
} as const;

export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const SalesOrderStatus = {
  CANCELLED: 'CANCELLED',
  CONFIRMED: 'CONFIRMED',
  DELIVERED: 'DELIVERED',
  DRAFT: 'DRAFT',
  INVOICED: 'INVOICED',
  PICKING: 'PICKING'
} as const;

export type SalesOrderStatus = (typeof SalesOrderStatus)[keyof typeof SalesOrderStatus];

export const DeliveryNoteStatus = {
  CANCELLED: 'CANCELLED',
  DELIVERED: 'DELIVERED',
  DISPATCHED: 'DISPATCHED',
  DRAFT: 'DRAFT'
} as const;

export type DeliveryNoteStatus = (typeof DeliveryNoteStatus)[keyof typeof DeliveryNoteStatus];

export const InvoiceStatus = {
  CANCELLED: 'CANCELLED',
  DRAFT: 'DRAFT',
  OVERDUE: 'OVERDUE',
  PAID: 'PAID',
  PARTIAL_PAID: 'PARTIAL_PAID',
  SENT: 'SENT'
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  CASH: 'CASH',
  CREDIT: 'CREDIT',
  ECOCASH: 'ECOCASH'
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const ReturnStatus = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  DRAFT: 'DRAFT'
} as const;

export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const customerStatusValues = Object.values(CustomerStatus) as [CustomerStatus, ...CustomerStatus[]];
export const quotationStatusValues = Object.values(QuotationStatus) as [QuotationStatus, ...QuotationStatus[]];
export const salesOrderStatusValues = Object.values(SalesOrderStatus) as [
  SalesOrderStatus,
  ...SalesOrderStatus[]
];
export const deliveryNoteStatusValues = Object.values(DeliveryNoteStatus) as [
  DeliveryNoteStatus,
  ...DeliveryNoteStatus[]
];
export const invoiceStatusValues = Object.values(InvoiceStatus) as [InvoiceStatus, ...InvoiceStatus[]];
export const paymentMethodValues = Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]];
export const returnStatusValues = Object.values(ReturnStatus) as [ReturnStatus, ...ReturnStatus[]];
