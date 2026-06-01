export const PurchaseRequisitionStatus = {
  CANCELLED: 'CANCELLED',
  DRAFT: 'DRAFT',
  LEVEL1_APPROVED: 'LEVEL1_APPROVED',
  LEVEL2_APPROVED: 'LEVEL2_APPROVED',
  LEVEL3_APPROVED: 'LEVEL3_APPROVED',
  LEVEL4_APPROVED: 'LEVEL4_APPROVED',
  PO_CREATED: 'PO_CREATED',
  REJECTED: 'REJECTED',
  SUBMITTED: 'SUBMITTED'
} as const;

export type PurchaseRequisitionStatus =
  (typeof PurchaseRequisitionStatus)[keyof typeof PurchaseRequisitionStatus];

export const PurchaseOrderStatus = {
  APPROVED: 'APPROVED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  CANCELLED: 'CANCELLED',
  DRAFT: 'DRAFT',
  FULLY_RECEIVED: 'FULLY_RECEIVED',
  LEVEL1_APPROVED: 'LEVEL1_APPROVED',
  LEVEL2_APPROVED: 'LEVEL2_APPROVED',
  LEVEL3_APPROVED: 'LEVEL3_APPROVED',
  PARTIAL_RECEIVED: 'PARTIAL_RECEIVED',
  SENT_TO_SUPPLIER: 'SENT_TO_SUPPLIER'
} as const;

export type PurchaseOrderStatus =
  (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const GRNStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  QUALITY_INSPECTION: 'QUALITY_INSPECTION',
  QUALITY_FAILED: 'QUALITY_FAILED',
  QUALITY_PASSED: 'QUALITY_PASSED',
  REJECTED: 'REJECTED',
  RECEIVED: 'RECEIVED'
} as const;

export type GRNStatus = (typeof GRNStatus)[keyof typeof GRNStatus];

export const QualityStatus = {
  CONDITIONAL_RELEASE: 'CONDITIONAL_RELEASE',
  FAILED: 'FAILED',
  PASSED: 'PASSED',
  PENDING: 'PENDING'
} as const;

export type QualityStatus = (typeof QualityStatus)[keyof typeof QualityStatus];

export const ReturnStatus = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  DRAFT: 'DRAFT'
} as const;

export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const purchaseRequisitionStatusValues = Object.values(PurchaseRequisitionStatus) as [
  PurchaseRequisitionStatus,
  ...PurchaseRequisitionStatus[]
];
export const purchaseOrderStatusValues = Object.values(PurchaseOrderStatus) as [
  PurchaseOrderStatus,
  ...PurchaseOrderStatus[]
];
export const grnStatusValues = Object.values(GRNStatus) as [GRNStatus, ...GRNStatus[]];
export const qualityStatusValues = Object.values(QualityStatus) as [
  QualityStatus,
  ...QualityStatus[]
];
export const returnStatusValues = Object.values(ReturnStatus) as [
  ReturnStatus,
  ...ReturnStatus[]
];
