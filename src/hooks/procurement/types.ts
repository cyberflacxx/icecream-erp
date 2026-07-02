'use client';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  category: {
    id: string;
    name: string;
  } | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  paymentTerms: string | null;
  creditLimit: number;
  currentBalance: number;
  documentName: string | null;
  documentUrl: string | null;
  status: string;
}

export interface SupplierFilters {
  categoryId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface SupplierHistoryRow {
  id: string;
  [key: string]: unknown;
}

export interface RequisitionRow {
  id: string;
  requisitionNumber: string;
  department: string;
  requestDate: string;
  neededByDate: string | null;
  status: string;
  approvalStatus: string;
  requestedBy: string;
  approverName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface RequisitionFilters {
  department?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  status?: string;
}

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: string;
  approverName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  supplier: {
    id: string;
    name: string;
  };
  itemsCount: number;
  total: number;
}

export interface PurchaseOrderFilters {
  endDate?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  status?: string;
  supplierId?: string;
}

export interface GRNRow {
  id: string;
  grnNumber: string;
  entryMode: string;
  purchaseOrder: {
    id: string;
    poNumber: string;
  } | null;
  supplier: {
    id: string;
    name: string;
  } | null;
  receivedDate: string;
  qualityStatus: string;
  status: string;
  itemsCount: number;
}

export interface GRNFilters {
  endDate?: string;
  page?: number;
  pageSize?: number;
  purchaseOrderId?: string;
  startDate?: string;
  status?: string;
}

export interface ProcurementDashboardMetrics {
  lateDeliveries: number;
  openPurchaseOrders: number;
  openPurchaseRequisitions: number;
  partiallyReceivedPurchaseOrders: number;
  pendingPurchaseApprovals: number;
  pendingSupplierReturns: number;
  supplierInvoicesDue: number;
  supplierShortages: number;
  topSuppliersByValue: Array<{ supplierName: string; totalValue: number }>;
}

export interface GoodsReceivingStatusRow {
  id: string;
  item: string;
  orderedQuantity: number;
  purchaseOrderNumber: string;
  receivedQuantity: number;
  rejectedQuantity: number;
  shortageQuantity: number;
  status: string;
  supplier: string;
}

export interface SupplierShortageRow {
  ageInDays: number;
  expectedResolutionDate: string | null;
  itemName: string;
  orderedQuantity: number;
  poNumber: string;
  receivedQuantity: number;
  shortageQuantity: number;
  status: string;
  supplierName: string;
}

export interface SupplierReturnRow {
  id: string;
  itemName: string;
  qcStatus: string | null;
  quantityReturned: number;
  reason: string;
  returnDate: string;
  returnNumber: string;
  status: string;
  supplierName: string;
}

export interface SupplierInvoiceRow {
  balance: number;
  dueDate: string | null;
  id: string;
  invoiceDate: string;
  invoiceNumber: string;
  paidAmount: number;
  purchaseOrderNumber: string | null;
  status: string;
  supplierId: string;
  supplierName: string;
  total: number;
}

export interface SupplierPaymentRow {
  amountPaid: number;
  id: string;
  invoiceNumber: string | null;
  method: string;
  paymentDate: string;
  reference: string | null;
  status: string;
  supplierName: string;
}

export interface ProcurementReportResponse<T> {
  data: T[];
  summary?: Record<string, number | string | null>;
}
