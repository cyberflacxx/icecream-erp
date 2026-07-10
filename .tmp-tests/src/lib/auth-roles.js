"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.ROLES = void 0;
exports.workIdToEmail = workIdToEmail;
exports.generateWorkId = generateWorkId;
exports.ROLES = [
    { id: 'super_admin', name: 'Super Admin', description: 'Full system access' },
    { id: 'branch_manager', name: 'Branch Manager', description: 'Manage a single branch' },
    { id: 'operations_manager', name: 'Operations Manager', description: 'Cross-functional operations oversight' },
    { id: 'production_manager', name: 'Production Manager', description: 'Production planning, batches, and throughput' },
    { id: 'sales_lead', name: 'Sales Lead', description: 'Sales orders, customers, invoicing, and collections' },
    { id: 'finance_lead', name: 'Finance Lead', description: 'Accounting, budgeting, journals, and reporting' },
    { id: 'procurement_lead', name: 'Procurement Lead', description: 'Suppliers, requisitions, purchase orders, and GRNs' },
    { id: 'inventory_lead', name: 'Inventory Lead', description: 'Warehouse stock control and inventory visibility' },
    { id: 'hr_lead', name: 'HR Lead', description: 'Employees, attendance, payroll, and labour records' },
    { id: 'quality_lead', name: 'Quality Lead', description: 'Inspections, quality control, and compliance records' },
    { id: 'manager', name: 'Manager', description: 'General management access' },
    { id: 'staff', name: 'Staff', description: 'Standard staff access' },
];
const ALL_PERMISSIONS = [
    'dashboard.read',
    'manage_roles',
    'settings.manage',
    'view_all_branches',
    'users.read', 'users.write', 'users.delete',
    'branches.read', 'branches.write',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'procurement.read', 'procurement.write', 'procurement.approve',
    'procurement.supplier.view', 'procurement.supplier.write',
    'production.read', 'production.write',
    'sales.read', 'sales.write',
    'finance.read', 'finance.write',
    'reports.read',
    'settings.read', 'settings.write',
    'hr.read', 'hr.write',
    'quality.read', 'quality.write',
    'maintenance.read', 'maintenance.write',
    'cost-accounting.read', 'cost-accounting.write',
    'budget.read', 'budget.write',
];
const BRANCH_MANAGER_PERMISSIONS = [
    'dashboard.read',
    'branches.read', 'branches.write',
    'inventory.read', 'inventory.write',
    'sales.read', 'sales.write',
    'reports.read',
];
const MANAGER_PERMISSIONS = [
    'dashboard.read',
    'branches.read',
    'inventory.read', 'inventory.write',
    'procurement.read', 'procurement.write', 'procurement.supplier.view',
    'production.read', 'production.write',
    'sales.read', 'sales.write',
    'finance.read',
    'reports.read',
    'quality.read', 'quality.write',
    'maintenance.read',
    'hr.read',
];
const OPERATIONS_MANAGER_PERMISSIONS = [
    'dashboard.read',
    'branches.read',
    'inventory.read', 'inventory.write',
    'procurement.read', 'procurement.write', 'procurement.supplier.view', 'procurement.supplier.write',
    'production.read', 'production.write',
    'sales.read', 'sales.write',
    'reports.read',
    'quality.read', 'quality.write',
    'maintenance.read', 'maintenance.write',
];
const PRODUCTION_MANAGER_PERMISSIONS = [
    'dashboard.read',
    'production.read', 'production.write',
    'inventory.read',
    'quality.read', 'quality.write',
    'reports.read',
];
const SALES_LEAD_PERMISSIONS = [
    'dashboard.read',
    'sales.read', 'sales.write',
    'reports.read',
];
const FINANCE_LEAD_PERMISSIONS = [
    'dashboard.read',
    'finance.read', 'finance.write',
    'budget.read', 'budget.write',
    'cost-accounting.read', 'cost-accounting.write',
    'reports.read',
];
const PROCUREMENT_LEAD_PERMISSIONS = [
    'dashboard.read',
    'procurement.read', 'procurement.write', 'procurement.approve',
    'procurement.supplier.view', 'procurement.supplier.write',
    'inventory.read',
    'reports.read',
];
const INVENTORY_LEAD_PERMISSIONS = [
    'dashboard.read',
    'inventory.read', 'inventory.write',
    'reports.read',
];
const HR_LEAD_PERMISSIONS = [
    'dashboard.read',
    'hr.read', 'hr.write',
    'reports.read',
];
const QUALITY_LEAD_PERMISSIONS = [
    'dashboard.read',
    'quality.read', 'quality.write',
    'production.read',
    'reports.read',
];
const STAFF_PERMISSIONS = [
    'dashboard.read',
    'inventory.read',
    'production.read',
    'sales.read',
    'reports.read',
    'quality.read',
    'hr.read',
];
exports.ROLE_PERMISSIONS = {
    super_admin: ALL_PERMISSIONS,
    branch_manager: BRANCH_MANAGER_PERMISSIONS,
    operations_manager: OPERATIONS_MANAGER_PERMISSIONS,
    production_manager: PRODUCTION_MANAGER_PERMISSIONS,
    sales_lead: SALES_LEAD_PERMISSIONS,
    finance_lead: FINANCE_LEAD_PERMISSIONS,
    procurement_lead: PROCUREMENT_LEAD_PERMISSIONS,
    inventory_lead: INVENTORY_LEAD_PERMISSIONS,
    hr_lead: HR_LEAD_PERMISSIONS,
    quality_lead: QUALITY_LEAD_PERMISSIONS,
    manager: MANAGER_PERMISSIONS,
    staff: STAFF_PERMISSIONS,
};
/** Synthetic email used in Supabase Auth for Work ID login. */
function workIdToEmail(workId) {
    return `${workId.toLowerCase()}@ice.erp`;
}
/** Generate a Work ID for the current year, given the last sequence number used. */
function generateWorkId(lastSeq) {
    const year = new Date().getFullYear();
    return `AQI-${year}${String(lastSeq + 1).padStart(4, '0')}`;
}
