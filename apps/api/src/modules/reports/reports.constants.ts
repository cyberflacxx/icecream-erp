export const ReportType = {
  BRANCH_SALES: 'branch_sales',
  BRANCH_SHIFT_CLOSE_SUMMARY: 'branch_shift_close_summary',
  DAILY_PRODUCTION: 'daily_production',
  EXPIRY_ALERT: 'expiry_alert',
  INVENTORY_VALUATION: 'inventory_valuation',
  LOW_STOCK: 'low_stock',
  RAW_MATERIAL_USAGE: 'raw_material_usage',
  SUPPLIER_PURCHASE: 'supplier_purchase',
  WASTAGE: 'wastage',
  WORKER_PRODUCTIVITY: 'worker_productivity'
} as const;

export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const reportTypeValues = Object.values(ReportType) as [ReportType, ...ReportType[]];
