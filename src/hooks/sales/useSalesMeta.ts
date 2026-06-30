'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppAuth } from '@/hooks/useAppAuth';
import { API_ROUTES } from '@/lib/shared';

import { useSalesRequest } from './useSalesRequest';

export interface SalesMetaCustomer {
  code: string;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  email: string | null;
  id: string;
  name: string;
  paymentTerms: string | null;
  phone: string | null;
  priceListCode: string | null;
  status: string;
}

export interface SalesMetaItem {
  availableQuantity: number;
  code: string;
  defaultPrice: number;
  id: string;
  name: string;
  type: string;
}

export interface SalesMetaWarehouse {
  branchId: string | null;
  code: string;
  id: string;
  name: string;
}

export interface SalesMetaSalesOrder {
  branchId: string | null;
  customerId: string;
  id: string;
  orderDate: string | null;
  orderNumber: string;
  requiredDate: string | null;
  status: string;
  total: number;
  warehouseId: string | null;
}

export interface SalesMetaInvoiceItem {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface SalesMetaInvoice {
  amountPaid: number;
  balanceDue: number;
  customerId: string;
  dueDate: string | null;
  id: string;
  invoiceDate: string | null;
  invoiceItems: SalesMetaInvoiceItem[];
  invoiceNumber: string;
  salesOrderId: string | null;
  status: string;
  total: number;
  warehouseId: string | null;
}

export interface SalesMetaResponse {
  branches: Array<{ code: string; id: string; name: string }>;
  customerGroups: Array<{ code: string; id: string; name: string }>;
  customers: SalesMetaCustomer[];
  invoices: SalesMetaInvoice[];
  items: SalesMetaItem[];
  prices: Array<{
    effectiveDate: string | null;
    expiryDate: string | null;
    id: string;
    isActive: boolean;
    itemId: string;
    priceListCode: string;
    sellingPrice: number;
  }>;
  salesOrders: SalesMetaSalesOrder[];
  warehouses: SalesMetaWarehouse[];
}

export function useSalesMeta() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const request = useSalesRequest();

  return useQuery({
    queryKey: ['sales', 'meta'],
    queryFn: () => request<SalesMetaResponse>(API_ROUTES.SALES.META),
    enabled: isLoaded && Boolean(isSignedIn),
  });
}
