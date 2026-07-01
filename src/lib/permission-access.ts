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
  'stores.grn.create': ['stores.grn.create', 'procurement.write', 'goods_received.create'],
  'stores.grn.edit': ['stores.grn.edit', 'procurement.write'],
  'stores.grn.submit': ['stores.grn.submit', 'procurement.write'],
  'stores.grn.approve': ['stores.grn.approve', 'procurement.approve'],
  'stores.grn.post': ['stores.grn.post', 'procurement.grn.post', 'inventory.write'],
  'stores.grn.print': ['stores.grn.print', 'procurement.read'],
  'stores.gin.view': ['stores.gin.view', 'inventory.read'],
  'stores.gin.create': ['stores.gin.create', 'inventory.write'],
  'stores.gin.edit': ['stores.gin.edit', 'inventory.write'],
  'stores.gin.approve': ['stores.gin.approve', 'inventory.write'],
  'stores.gin.post': ['stores.gin.post', 'inventory.write'],
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
  ],
  'quality.read': ['quality.read', 'quality.record', 'production_quality.read'],
  'quality.write': ['quality.write', 'quality.record', 'production_quality.approve'],
  'reports.read': ['reports.read', 'reports.export', 'reports.production', 'reports.inventory', 'reports.financial', 'reports.sales', 'reports.hr', 'reports.costing'],
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
  'procurement.requisition.approve': ['procurement.requisition.approve', 'purchase_requisition.approve', 'procurement.approve'],
  'procurement.po.approve': ['procurement.po.approve', 'purchase_order.approve', 'procurement.approve'],
  'procurement.grn.post': ['procurement.grn.post', 'procurement.write', 'inventory.write'],
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
