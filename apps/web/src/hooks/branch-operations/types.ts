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

export interface BranchCard {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  status: string;
  manager: {
    id: string;
    name: string;
  } | null;
  todaySales: number;
  stockStatus: string;
}

export interface BranchDashboard {
  date: string;
  stats: {
    openingStockValue: number;
    stockReceivedToday: number;
    stockSoldToday: number;
    closingStockEstimated: number;
  };
  payments: {
    cash: number;
    ecocash: number;
    card: number;
    expenses: number;
  };
  shiftClose: {
    id: string;
    shiftType: string;
    status: string;
  } | null;
}

export interface BranchSaleRow {
  id: string;
  saleNumber: string;
  saleDate: string;
  shift: string;
  itemsCount: number;
  totalAmount: number;
  paymentMethod: string;
  servedBy: string;
}

export interface BranchExpenseRow {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  createdBy: string;
}

export interface BranchShiftCloseRow {
  id: string;
  shiftDate: string;
  shiftType: string;
  status: string;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
  stockVariance: number;
}

export interface BranchShiftCloseDetail {
  id: string;
  shiftDate: string;
  shiftType: string;
  status: string;
  openingStockValue: number;
  stockReceivedValue: number;
  stockSoldValue: number;
  damagedStockValue: number;
  closingStockValue: number;
  expectedCash: number;
  actualCash: number;
  ecocashTotal: number;
  cardTotal: number;
  expensesTotal: number;
  cashVariance: number;
  stockVariance: number;
  notes: string | null;
}

export interface BranchStockRow {
  id: string;
  item: {
    id: string;
    code: string;
    name: string;
    itemType: string;
  };
  quantityOnHand: number;
  quantityAvailable: number;
  unitCost: number;
  totalValue: number;
}

export interface BranchSalesFilters {
  endDate?: string;
  page?: number;
  pageSize?: number;
  paymentMethod?: string;
  shift?: string;
  startDate?: string;
}

export interface BranchShiftCloseFilters {
  endDate?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  status?: string;
}
