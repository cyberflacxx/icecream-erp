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
  };
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  paymentTerms: string | null;
  creditLimit: number;
  currentBalance: number;
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
  requestedBy: string;
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
  purchaseOrder: {
    id: string;
    poNumber: string;
  };
  supplier: {
    id: string;
    name: string;
  };
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
