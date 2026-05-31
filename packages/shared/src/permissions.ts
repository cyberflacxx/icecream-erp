export const PERMISSIONS = {
  dashboard: {
    read: 'dashboard.read'
  },
  supplier: {
    read: 'supplier.read',
    create: 'supplier.create',
    update: 'supplier.update',
    delete: 'supplier.delete'
  },
  purchaseRequisition: {
    read: 'purchase_requisition.read',
    create: 'purchase_requisition.create',
    approve: 'purchase_requisition.approve'
  },
  purchaseOrder: {
    read: 'purchase_order.read',
    create: 'purchase_order.create',
    approve: 'purchase_order.approve'
  },
  goodsReceived: {
    read: 'goods_received.read',
    create: 'goods_received.create'
  },
  inventory: {
    read: 'inventory.read',
    adjust: 'inventory.adjust'
  },
  item: {
    manage: 'item.manage'
  },
  stockTransfer: {
    create: 'stock_transfer.create',
    approve: 'stock_transfer.approve'
  },
  productionRecipe: {
    read: 'production_recipe.read',
    manage: 'production_recipe.manage'
  },
  productionPlan: {
    read: 'production_plan.read',
    manage: 'production_plan.manage'
  },
  productionBatch: {
    read: 'production_batch.read',
    create: 'production_batch.create',
    close: 'production_batch.close',
    updateOutput: 'production_batch.update_output'
  },
  productionQuality: {
    read: 'production_quality.read',
    approve: 'production_quality.approve'
  },
  branchSales: {
    create: 'branch_sales.create',
    read: 'branch_sales.read'
  },
  branchShift: {
    read: 'branch_shift.read',
    approve: 'branch_shift.approve',
    close: 'branch_shift.close'
  },
  branchExpense: {
    create: 'branch_expense.create',
    approve: 'branch_expense.approve'
  },
  customer: {
    read: 'customer.read',
    create: 'customer.create',
    manage: 'customer.manage'
  },
  quotation: {
    read: 'quotation.read',
    create: 'quotation.create'
  },
  salesOrder: {
    read: 'sales_order.read',
    create: 'sales_order.create'
  },
  invoice: {
    read: 'invoice.read',
    create: 'invoice.create'
  },
  payment: {
    read: 'payment.read',
    create: 'payment.create'
  },
  finance: {
    read: 'finance.read',
    manage: 'finance.manage'
  },
  reports: {
    read: 'reports.read'
  },
  user: {
    manage: 'user.manage'
  },
  settings: {
    manage: 'settings.manage'
  },
  auditLog: {
    read: 'audit_log.read'
  }
} as const;

export const PERMISSION_CODES = {
  DASHBOARD_READ: PERMISSIONS.dashboard.read,
  SUPPLIER_READ: PERMISSIONS.supplier.read,
  SUPPLIER_CREATE: PERMISSIONS.supplier.create,
  SUPPLIER_UPDATE: PERMISSIONS.supplier.update,
  SUPPLIER_DELETE: PERMISSIONS.supplier.delete,
  PURCHASE_REQUISITION_READ: PERMISSIONS.purchaseRequisition.read,
  PURCHASE_REQUISITION_CREATE: PERMISSIONS.purchaseRequisition.create,
  PURCHASE_REQUISITION_APPROVE: PERMISSIONS.purchaseRequisition.approve,
  PURCHASE_ORDER_READ: PERMISSIONS.purchaseOrder.read,
  PURCHASE_ORDER_CREATE: PERMISSIONS.purchaseOrder.create,
  PURCHASE_ORDER_APPROVE: PERMISSIONS.purchaseOrder.approve,
  GOODS_RECEIVED_READ: PERMISSIONS.goodsReceived.read,
  GOODS_RECEIVED_CREATE: PERMISSIONS.goodsReceived.create,
  INVENTORY_READ: PERMISSIONS.inventory.read,
  INVENTORY_ADJUST: PERMISSIONS.inventory.adjust,
  ITEM_MANAGE: PERMISSIONS.item.manage,
  STOCK_TRANSFER_CREATE: PERMISSIONS.stockTransfer.create,
  STOCK_TRANSFER_APPROVE: PERMISSIONS.stockTransfer.approve,
  PRODUCTION_RECIPE_READ: PERMISSIONS.productionRecipe.read,
  PRODUCTION_RECIPE_MANAGE: PERMISSIONS.productionRecipe.manage,
  PRODUCTION_PLAN_READ: PERMISSIONS.productionPlan.read,
  PRODUCTION_PLAN_MANAGE: PERMISSIONS.productionPlan.manage,
  PRODUCTION_BATCH_CREATE: PERMISSIONS.productionBatch.create,
  PRODUCTION_BATCH_READ: PERMISSIONS.productionBatch.read,
  PRODUCTION_BATCH_CLOSE: PERMISSIONS.productionBatch.close,
  PRODUCTION_BATCH_UPDATE_OUTPUT: PERMISSIONS.productionBatch.updateOutput,
  PRODUCTION_QUALITY_READ: PERMISSIONS.productionQuality.read,
  PRODUCTION_QUALITY_APPROVE: PERMISSIONS.productionQuality.approve,
  BRANCH_SALES_CREATE: PERMISSIONS.branchSales.create,
  BRANCH_SALES_READ: PERMISSIONS.branchSales.read,
  BRANCH_SHIFT_READ: PERMISSIONS.branchShift.read,
  BRANCH_SHIFT_APPROVE: PERMISSIONS.branchShift.approve,
  BRANCH_SHIFT_CLOSE: PERMISSIONS.branchShift.close,
  BRANCH_EXPENSE_CREATE: PERMISSIONS.branchExpense.create,
  BRANCH_EXPENSE_APPROVE: PERMISSIONS.branchExpense.approve,
  CUSTOMER_READ: PERMISSIONS.customer.read,
  CUSTOMER_CREATE: PERMISSIONS.customer.create,
  CUSTOMER_MANAGE: PERMISSIONS.customer.manage,
  QUOTATION_READ: PERMISSIONS.quotation.read,
  QUOTATION_CREATE: PERMISSIONS.quotation.create,
  SALES_ORDER_READ: PERMISSIONS.salesOrder.read,
  SALES_ORDER_CREATE: PERMISSIONS.salesOrder.create,
  INVOICE_READ: PERMISSIONS.invoice.read,
  INVOICE_CREATE: PERMISSIONS.invoice.create,
  PAYMENT_READ: PERMISSIONS.payment.read,
  PAYMENT_CREATE: PERMISSIONS.payment.create,
  FINANCE_READ: PERMISSIONS.finance.read,
  FINANCE_MANAGE: PERMISSIONS.finance.manage,
  REPORTS_READ: PERMISSIONS.reports.read,
  USER_MANAGE: PERMISSIONS.user.manage,
  SETTINGS_MANAGE: PERMISSIONS.settings.manage,
  AUDIT_LOG_READ: PERMISSIONS.auditLog.read
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];
