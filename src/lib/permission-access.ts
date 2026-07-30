const PERMISSION_ALIASES: Record<string, string[]> = {
  'inventory.read': ['inventory.read', 'stock_transfer.read'],
  'inventory.write': ['inventory.write', 'inventory.create', 'inventory.adjust', 'inventory.write_off', 'stock_transfer.create', 'stock_transfer.approve'],
  'inventory.warehouse.view': ['inventory.warehouse.view', 'inventory.read', 'settings.manage'],
  'inventory.warehouse.create': ['inventory.warehouse.create', 'inventory.write', 'settings.manage'],
  'inventory.warehouse.edit': ['inventory.warehouse.edit', 'inventory.write', 'settings.manage'],
  'inventory.transfer.view': ['inventory.transfer.view', 'inventory.read', 'stock_transfer.read'],
  'inventory.transfer.create': ['inventory.transfer.create', 'inventory.write', 'stock_transfer.create'],
  'inventory.transfer.edit': ['inventory.transfer.edit', 'inventory.write', 'stock_transfer.create'],
  'inventory.transfer.approve': ['inventory.transfer.approve', 'inventory.write', 'stock_transfer.approve'],
  'inventory.transfer.complete': ['inventory.transfer.complete', 'inventory.write', 'stock_transfer.approve'],
  'inventory.transfer.cancel': ['inventory.transfer.cancel', 'inventory.write', 'stock_transfer.approve'],
  'inventory.adjustment.view': ['inventory.adjustment.view', 'inventory.read'],
  'inventory.adjustment.create': ['inventory.adjustment.create', 'inventory.adjust', 'inventory.write'],
  'inventory.adjustment.approve': ['inventory.adjustment.approve', 'inventory.write'],
  'inventory.adjustment.post': ['inventory.adjustment.post', 'inventory.write'],
  'inventory.report.view': ['inventory.report.view', 'inventory.read', 'reports.read'],
  'inventory.report.export': ['inventory.report.export', 'reports.read'],
  'inventory.override.negative_stock': ['inventory.override.negative_stock', 'inventory.write', 'settings.manage'],
  'inventory.override.over_issue': ['inventory.override.over_issue', 'inventory.write', 'settings.manage'],
  'inventory.override.batch_required': ['inventory.override.batch_required', 'inventory.write', 'settings.manage'],
  'stores.grn.view': ['stores.grn.view', 'procurement.read', 'inventory.read', 'goods_received.read'],
  'stores.grn.create': ['stores.grn.create', 'procurement.write', 'goods_received.create', 'inventory.write'],
  'stores.grn.edit': ['stores.grn.edit', 'procurement.write', 'inventory.write', 'goods_received.create', 'goods_received.update'],
  'stores.grn.submit': ['stores.grn.submit', 'procurement.write', 'inventory.write', 'goods_received.create', 'goods_received.update', 'goods_received.submit'],
  'stores.grn.approve': ['stores.grn.approve', 'procurement.approve'],
  'stores.grn.post': ['stores.grn.post', 'procurement.grn.post', 'inventory.write'],
  'stores.grn.print': ['stores.grn.print', 'procurement.read'],
  'stores.gin.view': ['stores.gin.view', 'inventory.read'],
  'stores.gin.create': ['stores.gin.create', 'inventory.write'],
  'stores.gin.edit': ['stores.gin.edit', 'inventory.write'],
  'stores.gin.approve': ['stores.gin.approve', 'inventory.write'],
  'stores.gin.post': ['stores.gin.post', 'inventory.write'],
  'finance.dashboard.view': ['finance.dashboard.view', 'finance.read', 'reports.read'],
  'finance.gl.view': ['finance.gl.view', 'finance.read', 'reports.read'],
  'finance.gl.create': ['finance.gl.create', 'finance.write'],
  'finance.gl.approve': ['finance.gl.approve', 'finance.approve', 'finance.write'],
  'finance.gl.post': ['finance.gl.post', 'finance.write'],
  'finance.gl.reverse': ['finance.gl.reverse', 'finance.write'],
  'finance.cost.view': ['finance.cost.view', 'finance.read', 'reports.costing', 'production_costing.read'],
  'finance.cost.manage': ['finance.cost.manage', 'finance.write', 'production.write'],
  'finance.cost.post': ['finance.cost.post', 'finance.write'],
  'finance.expense.view': ['finance.expense.view', 'finance.read'],
  'finance.expense.create': ['finance.expense.create', 'finance.write'],
  'finance.expense.edit': ['finance.expense.edit', 'finance.write'],
  'finance.expense.approve': ['finance.expense.approve', 'finance.approve', 'finance.write'],
  'finance.expense.post': ['finance.expense.post', 'finance.write'],
  'finance.bank.view': ['finance.bank.view', 'finance.read'],
  'finance.bank.create': ['finance.bank.create', 'finance.write'],
  'finance.bank.edit': ['finance.bank.edit', 'finance.write'],
  'finance.bank.reconcile': ['finance.bank.reconcile', 'finance.write'],
  'finance.cash.view': ['finance.cash.view', 'finance.read'],
  'finance.cash.create': ['finance.cash.create', 'finance.write'],
  'finance.cash.edit': ['finance.cash.edit', 'finance.write'],
  'finance.petty_cash.view': ['finance.petty_cash.view', 'finance.read'],
  'finance.petty_cash.create': ['finance.petty_cash.create', 'finance.write'],
  'finance.petty_cash.post': ['finance.petty_cash.post', 'finance.write'],
  'finance.report.view': ['finance.report.view', 'finance.read', 'reports.read', 'reports.financial'],
  'finance.report.export': ['finance.report.export', 'reports.export', 'finance.read'],
  'finance.integrity.view': ['finance.integrity.view', 'finance.read', 'settings.manage'],
  'finance.integrity.repair': ['finance.integrity.repair', 'finance.write', 'settings.manage'],
  'settings.read': ['settings.read', 'settings.manage', 'manage_roles', 'manage_users', 'view_audit_logs'],
  'settings.write': ['settings.write', 'settings.manage', 'manage_roles', 'manage_users'],
  'production.bom.view': ['production.bom.view', 'production.read', 'production_recipe.read', 'production_recipe.manage'],
  'production.bom.create': ['production.bom.create', 'production.write', 'production_recipe.manage'],
  'production.bom.edit': ['production.bom.edit', 'production.write', 'production_recipe.manage'],
  'production.bom.delete': ['production.bom.delete', 'production.write', 'production_recipe.manage'],
  'production.bom.approve': ['production.bom.approve', 'production.write', 'production_recipe.manage'],
  'production.bom.version': ['production.bom.version', 'production.write', 'production_recipe.manage'],
  'production.bom.deactivate': ['production.bom.deactivate', 'production.write', 'production_recipe.manage'],
  'production_order.view': ['production_order.view', 'production.read', 'production_plan.read', 'production_batch.read'],
  'production_order.create': ['production_order.create', 'production.write', 'production_plan.manage'],
  'production_order.edit_planned': ['production_order.edit_planned', 'production.write', 'production_plan.manage'],
  'production_order.release': ['production_order.release', 'production.write', 'production_plan.manage', 'production_batch.create'],
  'production_order.close': ['production_order.close', 'production.write', 'production_batch.close'],
  'production_order.view_cost': ['production_order.view_cost', 'production.cost.view', 'production_costing.read', 'reports.costing'],
  'production_order.view_relationship_map': ['production_order.view_relationship_map', 'production.traceability.view', 'production.read'],
  'production_issue.create': ['production_issue.create', 'production.write', 'production_material.issue'],
  'production_issue.post': ['production_issue.post', 'production.write', 'production_material.issue'],
  'production_issue.reverse': ['production_issue.reverse', 'production.write', 'settings.manage'],
  'production_receipt.create': ['production_receipt.create', 'production.write', 'production.finished_goods.receive'],
  'production_receipt.post': ['production_receipt.post', 'production.write', 'production.finished_goods.receive', 'inventory.write'],
  'production_receipt.reverse': ['production_receipt.reverse', 'production.write', 'settings.manage'],
  'production.plan_order.view': ['production.plan_order.view', 'production.read', 'production_plan.read', 'production_plan.manage'],
  'production.plan_order.create': ['production.plan_order.create', 'production.write', 'production_plan.manage'],
  'production.plan_order.edit': ['production.plan_order.edit', 'production.write', 'production_plan.manage'],
  'production.plan_order.calculate': ['production.plan_order.calculate', 'production.read', 'production_plan.manage'],
  'production.plan_order.submit': ['production.plan_order.submit', 'production.write', 'production_plan.manage'],
  'production.plan_order.approve': ['production.plan_order.approve', 'production.write', 'production_plan.manage'],
  'production.plan_order.reject': ['production.plan_order.reject', 'production.write', 'production_plan.manage'],
  'production.warehouse.view': ['production.warehouse.view', 'production.read', 'inventory.read'],
  'production.warehouse.receive': ['production.warehouse.receive', 'production.write', 'inventory.write', 'stock_transfer.create'],
  'production.warehouse.issue': ['production.warehouse.issue', 'production.write', 'production_material.issue'],
  'production.warehouse.transfer': ['production.warehouse.transfer', 'production.write', 'inventory.write', 'stock_transfer.create'],
  'production.warehouse.release': ['production.warehouse.release', 'production.write', 'production.finished_goods.release', 'production.finished_goods.receive'],
  'production.reporting.view': ['production.reporting.view', 'production.read', 'reports.read'],
  'production.reporting.create': ['production.reporting.create', 'production.write', 'shift_report.create', 'production_batch.update_output'],
  'production.reporting.edit': ['production.reporting.edit', 'production.write', 'production_batch.update_output'],
  'production.finished_goods.release': ['production.finished_goods.release', 'production.write', 'production.finished_goods.receive', 'production_batch.close'],
  'production.cost.view': ['production.cost.view', 'production.read', 'production_costing.read', 'reports.costing'],
  'production.cost.post': ['production.cost.post', 'production.write'],
  'production.traceability.view': ['production.traceability.view', 'production.read', 'reports.read', 'inventory.read'],
  'production.report.view': ['production.report.view', 'production.read', 'reports.read'],
  'production.report.export': ['production.report.export', 'reports.read', 'reports.export'],
  'production.batch.finance.post': ['production.batch.finance.post', 'production.write', 'finance.write'],
  'production.read': [
    'production.read',
    'production_batch.read',
    'production_plan.read',
    'production_plan.manage',
    'production_recipe.read',
    'production_recipe.manage',
    'production_material.request',
    'production_material.approve',
    'production_material.issue',
    'recipe.read',
    'recipe.create',
    'recipe.update',
    'shift_report.read',
    'shift_report.create',
    'production_costing.read',
    'production.bom.view',
    'production.plan_order.view',
    'production.plan_order.calculate',
    'production.warehouse.view',
    'production.reporting.view',
    'production.cost.view',
    'production.traceability.view',
    'production.report.view',
  ],
  'production.write': [
    'production.write',
    'production_batch.create',
    'production_batch.close',
    'production_batch.cancel',
    'production_batch.update_output',
    'production_plan.manage',
    'production_recipe.manage',
    'production_material.request',
    'production_material.approve',
    'production_material.issue',
    'recipe.create',
    'recipe.update',
    'shift_report.create',
    'wastage.record',
    'quality.record',
    'production.bom.create',
    'production.bom.edit',
    'production.bom.delete',
    'production.bom.approve',
    'production.bom.version',
    'production.bom.deactivate',
    'production_order.create',
    'production_order.edit_planned',
    'production_order.release',
    'production_order.close',
    'production_order.view_cost',
    'production_order.view_relationship_map',
    'production_issue.create',
    'production_issue.post',
    'production_issue.reverse',
    'production_receipt.create',
    'production_receipt.post',
    'production_receipt.reverse',
    'production.plan_order.create',
    'production.plan_order.edit',
    'production.plan_order.submit',
    'production.plan_order.approve',
    'production.plan_order.reject',
    'production.warehouse.receive',
    'production.warehouse.issue',
    'production.warehouse.transfer',
    'production.warehouse.release',
    'production.reporting.create',
    'production.reporting.edit',
    'production.finished_goods.release',
    'production.cost.post',
  ],
  'quality.production.inspect': ['quality.production.inspect', 'quality.read', 'quality.record', 'production_quality.read'],
  'quality.production.approve_release': ['quality.production.approve_release', 'quality.write', 'production_quality.approve'],
  'quality.read': ['quality.read', 'quality.record', 'production_quality.read', 'quality.production.inspect'],
  'quality.write': ['quality.write', 'quality.record', 'production_quality.approve', 'quality.production.approve_release'],
  'reports.read': ['reports.read', 'reports.export', 'reports.production', 'reports.inventory', 'reports.financial', 'reports.sales', 'reports.hr', 'reports.costing', 'production.report.view', 'production.report.export'],
  'sales.customer.view': ['sales.customer.view', 'sales.customer.read', 'customer.read', 'sales.read'],
  'sales.customer.create': ['sales.customer.create', 'sales.customer.add', 'customer.create', 'sales.write'],
  'sales.customer.edit': ['sales.customer.edit', 'sales.customer.update', 'customer.manage', 'sales.write'],
  'sales.customer.activate': ['sales.customer.activate', 'customer.manage', 'sales.write'],
  'sales.customer.deactivate': ['sales.customer.deactivate', 'customer.manage', 'sales.write'],
  'sales.customer.balance': ['sales.customer.balance', 'sales.customer.view', 'sales.read', 'finance.read'],
  'sales.customer.ledger': ['sales.customer.ledger', 'sales.customer.view', 'sales.read', 'finance.read'],
  'sales.quotation.create': ['sales.quotation.create', 'quotation.create', 'sales.write'],
  'sales.order.create': ['sales.order.create', 'sales_order.create', 'sales.write'],
  'sales.invoice.create': ['sales.invoice.create', 'invoice.create', 'sales.write', 'finance.write'],
  'sales.invoice.approve': ['sales.invoice.approve', 'invoice.approve', 'sales.write', 'finance.write'],
  'sales.payment.create': ['sales.payment.create', 'payment.create', 'sales.write', 'finance.write'],
  'sales.report.view': ['sales.report.view', 'reports.sales', 'reports.read', 'sales.read'],
  'procurement.supplier.view': ['procurement.supplier.view', 'supplier.read', 'procurement.read'],
  'procurement.supplier.create': ['procurement.supplier.create', 'procurement.supplier.write', 'supplier.create', 'procurement.write'],
  'procurement.supplier.edit': ['procurement.supplier.edit', 'procurement.supplier.write', 'supplier.update', 'procurement.write'],
  'procurement.supplier.activate': ['procurement.supplier.activate', 'procurement.supplier.write', 'supplier.update', 'procurement.write'],
  'procurement.supplier.deactivate': ['procurement.supplier.deactivate', 'procurement.supplier.write', 'supplier.update', 'procurement.write'],
  'procurement.supplier.import': ['procurement.supplier.import', 'procurement.supplier.write', 'procurement.write'],
  'procurement.category.view': ['procurement.category.view', 'procurement.read'],
  'procurement.category.create': ['procurement.category.create', 'procurement.write'],
  'procurement.item.view': ['procurement.item.view', 'item.manage', 'procurement.read', 'inventory.read'],
  'procurement.item.create': ['procurement.item.create', 'item.manage', 'procurement.write', 'inventory.write'],
  'procurement.price.view': ['procurement.price.view', 'procurement.read', 'finance.read'],
  'procurement.price.adjust': ['procurement.price.adjust', 'procurement.write', 'finance.write'],
  'procurement.dashboard.view': ['procurement.dashboard.view', 'procurement.read', 'reports.read'],
  'purchase_requisition.view': ['purchase_requisition.view', 'purchase_requisition.read', 'procurement.read'],
  'procurement.requisition.approve': ['procurement.requisition.approve', 'purchase_requisition.approve', 'procurement.approve'],
  'purchase_order.create': ['purchase_order.create', 'procurement.write'],
  'purchase_order.create_from_requisition': ['purchase_order.create_from_requisition', 'purchase_order.create', 'procurement.write'],
  'purchase_order.view': ['purchase_order.view', 'purchase_order.read', 'procurement.read'],
  'purchase_order.approve': ['purchase_order.approve', 'procurement.approve'],
  'procurement.po.approve': ['procurement.po.approve', 'purchase_order.approve', 'procurement.approve'],
  'goods_receipt.create': ['goods_receipt.create', 'goods_received.create', 'stores.grn.create', 'procurement.write'],
  'goods_receipt.post': ['goods_receipt.post', 'stores.grn.post', 'procurement.grn.post', 'inventory.write'],
  'goods_receipt.reverse': ['goods_receipt.reverse', 'stores.grn.reverse', 'inventory.write', 'settings.manage'],
  'procurement.grn.post': ['procurement.grn.post', 'procurement.write', 'inventory.write'],
  'supplier_invoice.create': ['supplier_invoice.create', 'invoice.create', 'procurement.write', 'finance.write'],
  'supplier_invoice.post': ['supplier_invoice.post', 'procurement.invoice.post', 'finance.write', 'procurement.write'],
  'procurement.invoice.post': ['procurement.invoice.post', 'procurement.write', 'finance.write'],
  'procurement.payment.post': ['procurement.payment.post', 'procurement.write', 'finance.write'],
  'procurement.report.view': ['procurement.report.view', 'procurement.read', 'reports.read'],
  'procurement.report.export': ['procurement.report.export', 'procurement.read', 'reports.read'],
  'production.batch.view': ['production.batch.view', 'production_batch.read', 'production_batch.view'],
  'production.batch.create': ['production.batch.create', 'production_batch.create'],
  'production.batch.edit': ['production.batch.edit', 'production_batch.update_output', 'production_batch.close'],
  'production.batch.start': ['production.batch.start', 'production_material.approve', 'production_batch.create'],
  'production.batch.complete': ['production.batch.complete', 'production_batch.close'],
  'production.material.issue': ['production.material.issue', 'production_material.issue'],
  'production.output.record': ['production.output.record', 'production_batch.update_output'],
  'production.qc.submit': ['production.qc.submit', 'quality.record', 'production_quality.approve'],
  'production.finished_goods.receive': ['production.finished_goods.receive', 'inventory.write', 'inventory.create'],
};

function replaceTrailingAction(permission: string) {
  if (permission.endsWith('.view')) return permission.slice(0, -5) + '.read';
  if (permission.endsWith('.edit')) return permission.slice(0, -5) + '.update';
  return null;
}

function dotToUnderscoreVariant(permission: string) {
  const parts = permission.split('.');
  if (parts.length < 3) return null;
  return `${parts[0]}_${parts[1]}.${parts.slice(2).join('.')}`;
}

export function expandPermissionVariants(permission: string) {
  const normalized = String(permission ?? '').trim();
  const variants = new Set<string>();

  if (!normalized) return variants;

  variants.add(normalized);

  const actionVariant = replaceTrailingAction(normalized);
  if (actionVariant) variants.add(actionVariant);

  const underscored = dotToUnderscoreVariant(normalized);
  if (underscored) {
    variants.add(underscored);
    const underscoredActionVariant = replaceTrailingAction(underscored);
    if (underscoredActionVariant) variants.add(underscoredActionVariant);
  }

  for (const alias of PERMISSION_ALIASES[normalized] ?? []) {
    variants.add(alias);
    const aliasActionVariant = replaceTrailingAction(alias);
    if (aliasActionVariant) variants.add(aliasActionVariant);
    const aliasUnderscored = dotToUnderscoreVariant(alias);
    if (aliasUnderscored) variants.add(aliasUnderscored);
  }

  return variants;
}

export function hasPermissionAccess(grantedPermissions: string[], ...requestedPermissions: string[]) {
  const granted = new Set<string>();

  for (const permission of grantedPermissions) {
    for (const variant of expandPermissionVariants(permission)) {
      granted.add(variant);
    }
  }

  return requestedPermissions.some((permission) => {
    for (const variant of expandPermissionVariants(permission)) {
      if (granted.has(variant)) {
        return true;
      }
    }

    return false;
  });
}
