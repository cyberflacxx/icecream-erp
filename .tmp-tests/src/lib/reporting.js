"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DASHBOARD_ROUTES = exports.REPORT_DEFINITIONS = void 0;
exports.findReportDefinition = findReportDefinition;
exports.resolveReportEndpointPath = resolveReportEndpointPath;
exports.validateReportDateRange = validateReportDateRange;
exports.emptyReportPayload = emptyReportPayload;
exports.normalizeReportErrorMessage = normalizeReportErrorMessage;
exports.shouldUseEmptyReportFallback = shouldUseEmptyReportFallback;
exports.toReportCsv = toReportCsv;
exports.REPORT_DEFINITIONS = [
    { category: 'inventory', code: 'stock-movement', name: 'Stock Movement Report', description: 'Incoming and outgoing stock movements by period.', path: '/api/inventory/reports/stock-movement', requiredPermission: 'inventory.read' },
    { category: 'inventory', code: 'valuation', name: 'Inventory Valuation Report', description: 'Closing stock values by warehouse and item.', path: '/api/inventory/reports/valuation', requiredPermission: 'view_cost' },
    { category: 'inventory', code: 'opening-closing', name: 'Opening and Closing Stock Report', description: 'Opening, in, out, and closing stock balances.', path: '/api/inventory/reports/opening-closing', requiredPermission: 'inventory.read' },
    { category: 'inventory', code: 'raw-materials', name: 'Raw Material Balance Report', description: 'Raw material balances and valuation.', path: '/api/inventory/reports/branch-stock', requiredPermission: 'inventory.read' },
    { category: 'inventory', code: 'wip', name: 'WIP Balance Report', description: 'Work in progress balances.', path: '/api/production/reports/batch-performance', requiredPermission: 'production.read' },
    { category: 'inventory', code: 'finished-goods', name: 'Finished Goods Balance Report', description: 'Finished goods stock balances.', path: '/api/inventory/reports/branch-stock', requiredPermission: 'inventory.read' },
    { category: 'inventory', code: 'warehouse-transfers', name: 'Warehouse Transfer Report', description: 'Stock transfer activity between warehouses.', path: '/api/inventory/reports/stock-movement', requiredPermission: 'inventory.read' },
    { category: 'inventory', code: 'stock-variance', name: 'Stock Variance Report', description: 'Stock take and adjustment variance report.', path: '/api/branches/reports/variance', requiredPermission: 'inventory.read' },
    { category: 'inventory', code: 'low-stock', name: 'Low Stock Report', description: 'Low stock and reorder alert positions.', path: '/api/inventory/dashboard', requiredPermission: 'inventory.read' },
    { category: 'procurement', code: 'purchase-orders', name: 'Purchase Order Report', description: 'Procurement purchase orders by period and supplier.', path: '/api/procurement/reports/purchase-orders', requiredPermission: 'procurement.read' },
    { category: 'procurement', code: 'goods-received', name: 'Goods Received Report', description: 'Goods received and supplier receipt history.', path: '/api/procurement/reports/purchase-orders', requiredPermission: 'procurement.read' },
    { category: 'procurement', code: 'supplier-shortages', name: 'Supplier Shortage Report', description: 'Ordered versus actual received quantities.', path: '/api/procurement/reports/supplier-shortages', requiredPermission: 'procurement.read' },
    { category: 'procurement', code: 'supplier-returns', name: 'Supplier Return Report', description: 'Supplier return lines and values.', path: '/api/procurement/reports/supplier-shortages', requiredPermission: 'procurement.read' },
    { category: 'procurement', code: 'supplier-performance', name: 'Supplier Performance Report', description: 'Supplier performance KPIs.', path: '/api/procurement/reports/supplier-performance', requiredPermission: 'procurement.read' },
    { category: 'procurement', code: 'cost-variance', name: 'Purchase Cost Variance Report', description: 'Procurement price and cost variance.', path: '/api/procurement/reports/cost-variance', requiredPermission: 'view_cost' },
    { category: 'production', code: 'performance', name: 'Production Performance Report', description: 'Production output and efficiency performance.', path: '/api/production/reports/performance', requiredPermission: 'production.read' },
    { category: 'production', code: 'batches', name: 'Batch Performance Report', description: 'Production batch-level detail.', path: '/api/production/reports/batch-performance', requiredPermission: 'production.read' },
    { category: 'production', code: 'boms', name: 'Bill of Materials Report', description: 'Active and draft BOM standards by finished product.', path: '/api/production/recipes', requiredPermission: 'production.read' },
    { category: 'production', code: 'plan-orders', name: 'Production Plan Order Report', description: 'Production plan orders by period, shift, and line.', path: '/api/production/plans', requiredPermission: 'production.read' },
    { category: 'production', code: 'material-consumption', name: 'Material Consumption Report', description: 'Material issues and usage by batch.', path: '/api/production/reports/material-consumption', requiredPermission: 'production.read' },
    { category: 'production', code: 'material-requirements', name: 'Material Requirement Report', description: 'Required raw materials against planned production output.', path: '/api/production/reports/material-consumption', requiredPermission: 'production.read' },
    { category: 'production', code: 'goods-receipts', name: 'Production Goods Receipt Report', description: 'Raw-material receipts into production and finished-goods receipts from production.', path: '/api/production/reports/goods-receipts', requiredPermission: 'production.read' },
    { category: 'production', code: 'goods-issues', name: 'Production Goods Issue Report', description: 'Raw-material goods issues posted to production batches.', path: '/api/production/reports/material-consumption', requiredPermission: 'production.read' },
    { category: 'production', code: 'raw-material-consumption', name: 'Raw Material Consumption Report', description: 'Consumed raw materials by production batch and variance.', path: '/api/production/reports/material-consumption', requiredPermission: 'production.read' },
    { category: 'production', code: 'expected-vs-actual', name: 'Expected Versus Actual Report', description: 'Expected versus actual production output and material usage.', path: '/api/production/reports/variance', requiredPermission: 'production.read' },
    { category: 'production', code: 'progress', name: 'Production Progress Report', description: 'Production progress by batch, shift, and output.', path: '/api/production/reports/performance', requiredPermission: 'production.read' },
    { category: 'production', code: 'planned-vs-actual', name: 'Planned Versus Actual Production Report', description: 'Planned production quantities compared to actual output.', path: '/api/production/reports/variance', requiredPermission: 'production.read' },
    { category: 'production', code: 'wastage', name: 'Wastage Report', description: 'Production wastage and losses.', path: '/api/production/reports/wastage', requiredPermission: 'production.read' },
    { category: 'production', code: 'wastage-scrap', name: 'Wastage and Scrap Report', description: 'Wastage, scrap, and rejected output by production batch.', path: '/api/production/reports/wastage', requiredPermission: 'production.read' },
    { category: 'production', code: 'yield', name: 'Yield Report', description: 'Yield and recovery report.', path: '/api/production/reports/yield', requiredPermission: 'production.read' },
    { category: 'production', code: 'productivity', name: 'Productivity Report', description: 'Output per worker and productivity trends.', path: '/api/production/reports/productivity', requiredPermission: 'production.read' },
    { category: 'production', code: 'shift-performance', name: 'Shift Performance Report', description: 'Shift performance by output, variance, and wastage.', path: '/api/production/reports/shift-performance', requiredPermission: 'production.read' },
    { category: 'production', code: 'finished-goods', name: 'Finished Goods Report', description: 'Finished-goods quantities produced, released, and transferred.', path: '/api/production/reports/finished-goods', requiredPermission: 'production.read' },
    { category: 'production', code: 'costing', name: 'Production Costing Report', description: 'Batch and product costing analysis.', path: '/api/production/reports/costing', requiredPermission: 'view_cost' },
    { category: 'production', code: 'costs', name: 'Production Cost Report', description: 'Production cost totals, unit cost, and variance view.', path: '/api/production/reports/costing', requiredPermission: 'view_cost' },
    { category: 'production', code: 'inventory-movements', name: 'Production Inventory Movement Report', description: 'Traceability view across raw-material transfers, issues, and finished-goods movements.', path: '/api/production/reports/inventory-movements', requiredPermission: 'production.read' },
    { category: 'production', code: 'efficiency', name: 'Production Efficiency Report', description: 'Shift and batch efficiency performance.', path: '/api/production/reports/efficiency', requiredPermission: 'production.read' },
    { category: 'production', code: 'daily', name: 'Daily Production Report', description: 'Daily production totals, output, and wastage.', path: '/api/production/reports/daily', requiredPermission: 'production.read' },
    { category: 'production', code: 'weekly', name: 'Weekly Production Report', description: 'Weekly production totals, output, and efficiency.', path: '/api/production/reports/weekly', requiredPermission: 'production.read' },
    { category: 'production', code: 'monthly', name: 'Monthly Production Report', description: 'Monthly production totals, output, and efficiency.', path: '/api/production/reports/monthly', requiredPermission: 'production.read' },
    { category: 'sales', code: 'daily-sales', name: 'Daily Sales Report', description: 'Daily sales and cash collection totals.', path: '/api/sales/reports/daily-sales', requiredPermission: 'sales.read' },
    { category: 'sales', code: 'customer-sales', name: 'Customer Sales Report', description: 'Sales by customer.', path: '/api/sales/reports/customer-sales', requiredPermission: 'sales.read' },
    { category: 'sales', code: 'product-sales', name: 'Product Sales Report', description: 'Sales by product.', path: '/api/sales/reports/product-sales', requiredPermission: 'sales.read' },
    { category: 'sales', code: 'invoice-ageing', name: 'Invoice Ageing Report', description: 'Outstanding invoices and ageing buckets.', path: '/api/sales/reports/invoice-ageing', requiredPermission: 'finance.read' },
    { category: 'sales', code: 'credit-limits', name: 'Customer Credit Limit Report', description: 'Customer balance and available credit.', path: '/api/sales/reports/credit-limits', requiredPermission: 'finance.read' },
    { category: 'sales', code: 'dispatches', name: 'Dispatch Report', description: 'Dispatch fulfilment and status.', path: '/api/sales/reports/dispatches', requiredPermission: 'sales.read' },
    { category: 'sales', code: 'returns', name: 'Returns Report', description: 'Sales return activity and values.', path: '/api/sales/reports/returns', requiredPermission: 'sales.read' },
    { category: 'sales', code: 'prices', name: 'Price List Report', description: 'Price list and price changes.', path: '/api/sales/prices', requiredPermission: 'view_price' },
    { category: 'sales', code: 'discounts', name: 'Discount Report', description: 'Discount approvals and usage.', path: '/api/sales/discounts', requiredPermission: 'view_price' },
    { category: 'branches', code: 'daily-sales', name: 'Branch Daily Sales Report', description: 'Daily sales per branch.', path: '/api/branches/reports/daily-sales', requiredPermission: 'sales.read' },
    { category: 'branches', code: 'shifts', name: 'Branch Shift Report', description: 'Shift closure, cash-up, and variance results.', path: '/api/branches/reports/shift', requiredPermission: 'reports.read' },
    { category: 'branches', code: 'stock', name: 'Branch Stock Report', description: 'Branch stock movement and balances.', path: '/api/branches/reports/stock-balance', requiredPermission: 'inventory.read' },
    { category: 'branches', code: 'cash-up', name: 'Branch Cash-Up Report', description: 'Branch cash-up history.', path: '/api/branches/reports/cash-up', requiredPermission: 'finance.read' },
    { category: 'branches', code: 'expenses', name: 'Branch Expense Report', description: 'Branch expense activity and totals.', path: '/api/branches/reports/expenses', requiredPermission: 'finance.read' },
    { category: 'branches', code: 'returns', name: 'Branch Returns Report', description: 'Branch return activity.', path: '/api/branches/reports/returns', requiredPermission: 'quality.read' },
    { category: 'branches', code: 'variance', name: 'Branch Stock Variance Report', description: 'Branch stock variance and reconciliation.', path: '/api/branches/reports/variance', requiredPermission: 'inventory.read' },
    { category: 'branches', code: 'profitability', name: 'Branch Profitability Report', description: 'Branch gross and net profitability.', path: '/api/branches/reports/profitability', requiredPermission: 'view_cost' },
    { category: 'branches', code: 'reconciliation', name: 'Branch Reconciliation Report', description: 'Branch shift and cash reconciliation summary.', path: '/api/branches/reports/shift', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'trial-balance', name: 'Trial Balance', description: 'Trial balance by account and period.', path: '/api/finance/reports/trial-balance', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'profit-and-loss', name: 'Profit and Loss Statement', description: 'Profit and loss summary.', path: '/api/finance/reports/profit-and-loss', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'balance-sheet', name: 'Balance Sheet', description: 'Balance sheet by reporting period.', path: '/api/finance/reports/balance-sheet', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'ratios', name: 'Financial Ratios', description: 'Liquidity, leverage, and profitability ratios.', path: '/api/finance/reports/ratios', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'cash-flow', name: 'Cash Flow Statement', description: 'Cash flow by operating, investing, and financing activity.', path: '/api/finance/reports/cash-flow', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'general-ledger', name: 'General Ledger Report', description: 'Detailed ledger lines by account.', path: '/api/finance/reports/general-ledger', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'receivables-ageing', name: 'Accounts Receivable Ageing Report', description: 'Receivables balances by ageing bucket.', path: '/api/finance/reports/receivables-ageing', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'payables-ageing', name: 'Accounts Payable Ageing Report', description: 'Payables balances by ageing bucket.', path: '/api/finance/reports/payables-ageing', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'budget-variance', name: 'Budget Variance Report', description: 'Budget versus actual variance.', path: '/api/finance/reports/budget-variance', requiredPermission: 'view_cost' },
    { category: 'finance', code: 'production-costing', name: 'Production Cost Accounting Report', description: 'Production cost accounting and unit cost analysis.', path: '/api/finance/reports/production-costing', requiredPermission: 'view_cost' },
    { category: 'finance', code: 'branch-costing', name: 'Branch Cost Accounting Report', description: 'Branch cost accounting and profitability.', path: '/api/finance/reports/branch-costing', requiredPermission: 'view_cost' },
    { category: 'finance', code: 'tax', name: 'Tax Report', description: 'Tax summary and tax transactions.', path: '/api/finance/reports/tax', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'ratios', name: 'Financial Ratios', description: 'Liquidity, profitability, and leverage ratios.', path: '/api/finance/reports/ratios', requiredPermission: 'finance.read' },
    { category: 'finance', code: 'fixed-assets', name: 'Fixed Assets Report', description: 'Fixed asset register and balances.', path: '/api/finance/fixed-assets', requiredPermission: 'finance.read' },
    { category: 'quality', code: 'raw-materials', name: 'Raw Material Quality Report', description: 'Raw material inspection outcomes.', path: '/api/quality/reports/raw-materials', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'production', name: 'Production Quality Report', description: 'Production quality inspections and failures.', path: '/api/quality/reports/production', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'returns', name: 'Customer and Branch Returns Report', description: 'Returns and QC outcomes.', path: '/api/quality/reports/returns', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'damaged-goods', name: 'Damaged Goods Report', description: 'Damaged goods quantities and values.', path: '/api/quality/reports/damaged-goods', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'expired-goods', name: 'Expired Goods Report', description: 'Expired goods positions and values.', path: '/api/quality/reports/expired-goods', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'waste', name: 'Waste Disposal Report', description: 'Waste and disposal records.', path: '/api/quality/reports/waste', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'market', name: 'Market Quality Report', description: 'Market quality findings and actions.', path: '/api/quality/reports/market', requiredPermission: 'quality.read' },
    { category: 'quality', code: 'financial-impact', name: 'QC Financial Impact Report', description: 'Financial impact of QC failures and returns.', path: '/api/quality/reports/financial-impact', requiredPermission: 'quality.read' },
    { category: 'audit', code: 'logins', name: 'User Login Report', description: 'Successful login activity.', path: '/api/security/events?eventType=LOGIN_SUCCESS', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'failed-logins', name: 'Failed Login Report', description: 'Failed and lockout login activity.', path: '/api/security/events?eventType=LOGIN_FAILED', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'user-activity', name: 'User Activity Report', description: 'Audit log activity by user and action.', path: '/api/security/audit-logs', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'approval-history', name: 'Approval History Report', description: 'Approval and rejection action history.', path: '/api/security/approvals', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'posted-transactions', name: 'Posted Transactions Report', description: 'Posted transaction audit entries.', path: '/api/security/audit-logs?action=POST', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'voided-transactions', name: 'Voided Transactions Report', description: 'Voided transaction activity.', path: '/api/security/events?eventType=VOIDED_TRANSACTION', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'permission-changes', name: 'Role and Permission Change Report', description: 'Role and permission change activity.', path: '/api/security/events?eventType=PERMISSION_CHANGED', requiredPermission: 'view_audit_logs' },
    { category: 'audit', code: 'data-exports', name: 'Data Export Report', description: 'Report and data export activity.', path: '/api/security/events?eventType=DATA_EXPORT', requiredPermission: 'view_audit_logs' },
];
exports.DASHBOARD_ROUTES = {
    branch: '/api/dashboard',
    finance: '/api/finance/dashboard',
    inventory: '/api/inventory/dashboard',
    management: '/api/dashboard',
    production: '/api/production/dashboard',
    quality: '/api/quality/dashboard',
    sales: '/api/sales/dashboard',
};
const PRODUCTION_REPORT_ENDPOINT_ALIASES = {
    'batch-performance': '/api/production/reports/batch-performance',
    costing: '/api/production/reports/costing',
    daily: '/api/production/reports/daily',
    efficiency: '/api/production/reports/efficiency',
    'expected-vs-actual': '/api/production/reports/variance',
    'finished-goods': '/api/production/reports/finished-goods',
    'goods-issues': '/api/production/reports/material-consumption',
    'goods-receipts': '/api/production/reports/goods-receipts',
    'inventory-movements': '/api/production/reports/inventory-movements',
    'material-consumption': '/api/production/reports/material-consumption',
    monthly: '/api/production/reports/monthly',
    performance: '/api/production/reports/performance',
    productivity: '/api/production/reports/productivity',
    'planned-vs-actual': '/api/production/reports/variance',
    'raw-material-consumption': '/api/production/reports/material-consumption',
    'shift-performance': '/api/production/reports/shift-performance',
    variance: '/api/production/reports/variance',
    wastage: '/api/production/reports/wastage',
    'wastage-scrap': '/api/production/reports/wastage',
    weekly: '/api/production/reports/weekly',
    yield: '/api/production/reports/yield',
};
function findReportDefinition(category, reportType) {
    return exports.REPORT_DEFINITIONS.find((definition) => definition.category === category && definition.code === reportType) ?? null;
}
function resolveReportEndpointPath(category, reportType, fallbackPath) {
    if (category !== 'production')
        return fallbackPath;
    return PRODUCTION_REPORT_ENDPOINT_ALIASES[reportType] ?? fallbackPath;
}
function validateReportDateRange(startDate, endDate) {
    if (startDate && endDate && new Date(startDate).getTime() > new Date(endDate).getTime()) {
        throw new Error('Date from must not be after date to.');
    }
}
function emptyReportPayload(options) {
    return {
        chart: [],
        data: [],
        ...(options?.meta ? { meta: options.meta } : {}),
        summary: options?.summary ?? {},
        ...(options?.warning ? { warning: options.warning } : {}),
    };
}
function normalizeReportErrorMessage(value) {
    if (value instanceof Error) {
        return normalizeReportErrorMessage(value.message);
    }
    if (typeof value === 'object' && value !== null && 'error' in value) {
        return normalizeReportErrorMessage(value.error);
    }
    if (typeof value === 'object' && value !== null && 'message' in value) {
        return normalizeReportErrorMessage(value.message);
    }
    const text = String(value ?? '').trim();
    if (!text)
        return 'Report data is not currently available.';
    try {
        const parsed = JSON.parse(text);
        const candidate = parsed.error ?? parsed.message;
        if (candidate)
            return normalizeReportErrorMessage(candidate);
    }
    catch { }
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        return 'Report data is not currently available.';
    }
    return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}
function shouldUseEmptyReportFallback(error, status) {
    if (status !== undefined && [400, 401, 403].includes(status)) {
        return false;
    }
    const message = normalizeReportErrorMessage(error).toLowerCase();
    if (!message)
        return true;
    return (status === 404 ||
        status === 500 ||
        message.includes('internal server error') ||
        message.includes('report data is not currently available') ||
        message.includes('failed to fetch') ||
        message.includes('unexpected token') ||
        message.includes('does not exist') ||
        message.includes('could not find the table') ||
        message.includes('could not find a relationship between') ||
        message.includes('could not find a relationship') ||
        message.includes('column ') ||
        message.includes('relation ') ||
        message.includes('unsupported report type'));
}
function toReportCsv(options) {
    const metadataRows = [
        ['Report Title', options.title],
        ['Generated By', options.generatedBy],
        ['Generated At', options.generatedAt],
        ['Filters', JSON.stringify(options.filters)],
        [],
    ];
    if (options.rows.length === 0) {
        return metadataRows.map((row) => row.join(',')).join('\n');
    }
    const headers = Object.keys(options.rows[0] ?? {});
    const dataRows = [
        headers.join(','),
        ...options.rows.map((row) => headers
            .map((header) => {
            const value = row[header];
            if (value === null || value === undefined)
                return '';
            const asString = String(value).replace(/"/g, '""');
            return /[",\n]/.test(asString) ? `"${asString}"` : asString;
        })
            .join(',')),
    ];
    return [...metadataRows.map((row) => row.join(',')), ...dataRows].join('\n');
}
