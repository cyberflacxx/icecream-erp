import { ensureNonNegative, toNumber } from './inventory';

export const FINANCE_ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'COST_OF_SALES',
  'HEADER',
  'CONTRA_ASSET',
  'CONTRA_REVENUE',
  'OTHER_INCOME',
] as const;

export type FinanceAccountType = (typeof FINANCE_ACCOUNT_TYPES)[number];
export type FinanceNormalBalance = 'DEBIT' | 'CREDIT' | null;

export interface OfficialFinanceAccountDefinition {
  allowPosting?: boolean;
  code: string;
  compatibilityOnly?: boolean;
  name: string;
  normalBalance?: FinanceNormalBalance;
  parentCode?: string | null;
  type: FinanceAccountType;
}

export interface FinanceMappingDefinition {
  fallbackAccountCode: string;
  key: string;
  notes?: string;
}

export interface FinanceCostCentreDefinition {
  code: string;
  name: string;
  parentCode?: string | null;
}

export interface FinanceAccountRecord {
  accountCode: string;
  accountName: string;
  accountType: FinanceAccountType;
  allowPosting: boolean;
  currentBalance: number;
  description: string | null;
  id: string;
  isActive: boolean;
  normalBalance: FinanceNormalBalance;
  organizationId: string | null;
  parentAccountCode: string | null;
  parentAccountId: string | null;
}

export interface FinanceAccountTreeNode extends FinanceAccountRecord {
  children: FinanceAccountTreeNode[];
  depth: number;
  path: string[];
}

export interface OpeningBalanceDraftLine {
  accountId?: string | null;
  accountCode?: string | null;
  creditAmount: number;
  debitAmount: number;
}

export const OFFICIAL_CHART_OF_ACCOUNTS: OfficialFinanceAccountDefinition[] = [
  { code: '1000', name: 'Assets', type: 'HEADER' },
  { code: '1100', name: 'Current Assets', type: 'HEADER', parentCode: '1000' },
  { code: '1110', name: 'Cash on Hand', type: 'ASSET', parentCode: '1100' },
  { code: '1120', name: 'Bank Account', type: 'ASSET', parentCode: '1100' },
  { code: '1130', name: 'Petty Cash', type: 'ASSET', parentCode: '1100' },
  { code: '1140', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1100' },
  { code: '1150', name: 'Vendor Receivables', type: 'ASSET', parentCode: '1100' },
  { code: '1160', name: 'Employee Advances', type: 'ASSET', parentCode: '1100' },
  { code: '1170', name: 'VAT Input', type: 'ASSET', parentCode: '1100' },
  { code: '1180', name: 'Prepaid Expenses', type: 'ASSET', parentCode: '1100' },
  { code: '1200', name: 'Inventory Control', type: 'HEADER', parentCode: '1100' },
  { code: '1210', name: 'Raw Materials Inventory', type: 'ASSET', parentCode: '1200' },
  { code: '1211', name: 'Ice Cream Mix', type: 'ASSET', parentCode: '1210' },
  { code: '1212', name: 'UHT Milk', type: 'ASSET', parentCode: '1210' },
  { code: '1213', name: 'Chocolate', type: 'ASSET', parentCode: '1210' },
  { code: '1214', name: 'Sugar', type: 'ASSET', parentCode: '1210' },
  { code: '1215', name: 'Flavours', type: 'ASSET', parentCode: '1210' },
  { code: '1216', name: 'Colouring', type: 'ASSET', parentCode: '1210' },
  { code: '1217', name: 'Packaging Materials', type: 'ASSET', parentCode: '1210' },
  { code: '1218', name: 'Cones', type: 'ASSET', parentCode: '1217' },
  { code: '1219', name: 'Cups', type: 'ASSET', parentCode: '1217' },
  { code: '1220', name: 'Lids', type: 'ASSET', parentCode: '1217' },
  { code: '1221', name: 'Cheese', type: 'ASSET', parentCode: '1210' },
  { code: '1222', name: 'Yoghurt', type: 'ASSET', parentCode: '1210' },
  { code: '1230', name: 'Work In Progress', type: 'ASSET', parentCode: '1200' },
  { code: '1240', name: 'Finished Goods Inventory', type: 'ASSET', parentCode: '1200' },
  { code: '1250', name: 'Branch Inventory', type: 'ASSET', parentCode: '1200' },
  { code: '1260', name: 'Goods In Transit', type: 'ASSET', parentCode: '1200' },
  { code: '1270', name: 'Inventory Variance', type: 'ASSET', parentCode: '1200' },
  { code: '1300', name: 'Property Plant and Equipment', type: 'HEADER', parentCode: '1000' },
  { code: '1310', name: 'Buildings', type: 'ASSET', parentCode: '1300' },
  { code: '1320', name: 'Machinery', type: 'ASSET', parentCode: '1300' },
  { code: '1330', name: 'Freezers', type: 'ASSET', parentCode: '1300' },
  { code: '1340', name: 'Vehicles', type: 'ASSET', parentCode: '1300' },
  { code: '1350', name: 'Office Equipment', type: 'ASSET', parentCode: '1300' },
  { code: '1360', name: 'Computers', type: 'ASSET', parentCode: '1300' },
  { code: '1370', name: 'Accumulated Depreciation', type: 'CONTRA_ASSET', parentCode: '1300' },
  { code: '2000', name: 'Current Liabilities', type: 'HEADER' },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2110', name: 'Supplier Payables', type: 'LIABILITY', parentCode: '2000' },
  { code: '2120', name: 'Accrued Expenses', type: 'LIABILITY', parentCode: '2000' },
  { code: '2130', name: 'PAYE Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2140', name: 'NSSA Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2150', name: 'Pension Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2160', name: 'VAT Output', type: 'LIABILITY', parentCode: '2000' },
  { code: '2170', name: 'VAT Payable', type: 'LIABILITY', parentCode: '2000' },
  { code: '2180', name: 'Loans', type: 'LIABILITY', parentCode: '2000' },
  { code: '2190', name: 'Customer Deposits', type: 'LIABILITY', parentCode: '2000' },
  { code: '3000', name: "Owner's Capital", type: 'EQUITY' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
  { code: '3200', name: 'Current Year Profit', type: 'EQUITY' },
  { code: '4000', name: 'Sales Revenue', type: 'HEADER' },
  { code: '4010', name: 'Ice Cream Cone Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4020', name: 'Cups Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4030', name: '5L Ice Cream Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4040', name: '2L Ice Cream Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4050', name: 'Yoghurt Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4060', name: 'Cheese Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4070', name: 'Branch Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4080', name: 'Wholesale Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4090', name: 'Retail Sales', type: 'REVENUE', parentCode: '4000' },
  { code: '4100', name: 'Discount Allowed', type: 'CONTRA_REVENUE', parentCode: '4000' },
  { code: '4110', name: 'Sales Returns', type: 'CONTRA_REVENUE', parentCode: '4000' },
  { code: '4120', name: 'Default Sales Revenue', type: 'REVENUE', parentCode: '4000', compatibilityOnly: true },
  { code: '5000', name: 'Cost of Goods Sold', type: 'HEADER' },
  { code: '5010', name: 'Raw Materials Consumed', type: 'EXPENSE', parentCode: '5000' },
  { code: '5020', name: 'Packaging Cost', type: 'EXPENSE', parentCode: '5000' },
  { code: '5030', name: 'Chocolate Consumption', type: 'EXPENSE', parentCode: '5000' },
  { code: '5040', name: 'Ice Cream Mix Consumption', type: 'EXPENSE', parentCode: '5000' },
  { code: '5050', name: 'UHT Consumption', type: 'EXPENSE', parentCode: '5000' },
  { code: '5060', name: 'Production Labour', type: 'EXPENSE', parentCode: '5000' },
  { code: '5070', name: 'Production Overheads', type: 'EXPENSE', parentCode: '5000' },
  { code: '5080', name: 'Factory Utilities', type: 'EXPENSE', parentCode: '5000' },
  { code: '5090', name: 'Inventory Write Off', type: 'EXPENSE', parentCode: '5000' },
  { code: '5100', name: 'Production Variance', type: 'EXPENSE', parentCode: '5000' },
  { code: '5110', name: 'Default Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000', compatibilityOnly: true },
  { code: '6000', name: 'Administrative Expenses', type: 'HEADER' },
  { code: '6010', name: 'Salaries and Wages', type: 'EXPENSE', parentCode: '6000' },
  { code: '6020', name: 'Rent', type: 'EXPENSE', parentCode: '6000' },
  { code: '6030', name: 'Electricity', type: 'EXPENSE', parentCode: '6000' },
  { code: '6040', name: 'Water', type: 'EXPENSE', parentCode: '6000' },
  { code: '6050', name: 'Fuel', type: 'EXPENSE', parentCode: '6000' },
  { code: '6060', name: 'Vehicle Expenses', type: 'EXPENSE', parentCode: '6000' },
  { code: '6070', name: 'Repairs and Maintenance', type: 'EXPENSE', parentCode: '6000' },
  { code: '6080', name: 'Internet', type: 'EXPENSE', parentCode: '6000' },
  { code: '6090', name: 'Telephone', type: 'EXPENSE', parentCode: '6000' },
  { code: '6100', name: 'Office Expenses', type: 'EXPENSE', parentCode: '6000' },
  { code: '6110', name: 'Printing and Stationery', type: 'EXPENSE', parentCode: '6000' },
  { code: '6120', name: 'Cleaning', type: 'EXPENSE', parentCode: '6000' },
  { code: '6130', name: 'Security', type: 'EXPENSE', parentCode: '6000' },
  { code: '6140', name: 'Marketing', type: 'EXPENSE', parentCode: '6000' },
  { code: '6150', name: 'Advertising', type: 'EXPENSE', parentCode: '6000' },
  { code: '6160', name: 'Bank Charges', type: 'EXPENSE', parentCode: '6000' },
  { code: '6170', name: 'Insurance', type: 'EXPENSE', parentCode: '6000' },
  { code: '6180', name: 'Legal and Professional Fees', type: 'EXPENSE', parentCode: '6000' },
  { code: '6190', name: 'Depreciation', type: 'EXPENSE', parentCode: '6000' },
  { code: '6200', name: 'Training', type: 'EXPENSE', parentCode: '6000' },
  { code: '6210', name: 'Travel', type: 'EXPENSE', parentCode: '6000' },
  { code: '6220', name: 'Staff Welfare', type: 'EXPENSE', parentCode: '6000' },
  { code: '6230', name: 'Uniforms', type: 'EXPENSE', parentCode: '6000' },
  { code: '6240', name: 'Licences and Permits', type: 'EXPENSE', parentCode: '6000' },
  { code: '7000', name: 'Other Income', type: 'HEADER' },
  { code: '7010', name: 'Interest Income', type: 'OTHER_INCOME', parentCode: '7000' },
  { code: '7020', name: 'Rental Income', type: 'OTHER_INCOME', parentCode: '7000' },
  { code: '7030', name: 'Profit on Asset Disposal', type: 'OTHER_INCOME', parentCode: '7000' },
  { code: '7040', name: 'Exchange Gain', type: 'OTHER_INCOME', parentCode: '7000' },
  { code: '8000', name: 'Finance Costs', type: 'HEADER' },
  { code: '8010', name: 'Interest Expense', type: 'EXPENSE', parentCode: '8000' },
  { code: '8020', name: 'Exchange Loss', type: 'EXPENSE', parentCode: '8000' },
  { code: '8030', name: 'Tax Expense', type: 'EXPENSE', parentCode: '8000' },
] as const;

export const DEFAULT_FINANCE_COST_CENTRES: FinanceCostCentreDefinition[] = [
  { code: 'FACTORY', name: 'Factory' },
  { code: 'PRODUCTION_DAY', name: 'Production Day Shift', parentCode: 'FACTORY' },
  { code: 'PRODUCTION_NIGHT', name: 'Production Night Shift', parentCode: 'FACTORY' },
  { code: 'STORES', name: 'Stores' },
  { code: 'DISPATCH', name: 'Dispatch' },
  { code: 'PROCUREMENT', name: 'Procurement' },
  { code: 'FINANCE', name: 'Finance' },
  { code: 'ADMIN', name: 'Administration' },
  { code: 'HR', name: 'HR' },
  { code: 'SALES', name: 'Sales' },
  { code: 'MARKETING', name: 'Marketing' },
] as const;

export const DEFAULT_FINANCE_TRANSACTION_MAPPINGS: FinanceMappingDefinition[] = [
  { key: 'CASH_ACCOUNT', fallbackAccountCode: '1110' },
  { key: 'BANK_ACCOUNT', fallbackAccountCode: '1120' },
  { key: 'PETTY_CASH_ACCOUNT', fallbackAccountCode: '1130' },
  { key: 'ACCOUNTS_RECEIVABLE', fallbackAccountCode: '1140' },
  { key: 'VAT_INPUT', fallbackAccountCode: '1170' },
  { key: 'RAW_MATERIAL_INVENTORY', fallbackAccountCode: '1210' },
  { key: 'PACKAGING_INVENTORY', fallbackAccountCode: '1217' },
  { key: 'WORK_IN_PROGRESS', fallbackAccountCode: '1230' },
  { key: 'FINISHED_GOODS_INVENTORY', fallbackAccountCode: '1240' },
  { key: 'BRANCH_INVENTORY', fallbackAccountCode: '1250' },
  { key: 'GOODS_IN_TRANSIT', fallbackAccountCode: '1260' },
  { key: 'INVENTORY_VARIANCE', fallbackAccountCode: '1270' },
  { key: 'ACCOUNTS_PAYABLE', fallbackAccountCode: '2100' },
  { key: 'SUPPLIER_PAYABLES', fallbackAccountCode: '2110' },
  { key: 'VAT_OUTPUT', fallbackAccountCode: '2160' },
  { key: 'VAT_PAYABLE', fallbackAccountCode: '2170' },
  { key: 'DEFAULT_SALES_REVENUE', fallbackAccountCode: '4120', notes: 'Dedicated posting child added for generic sales postings.' },
  { key: 'BRANCH_SALES_REVENUE', fallbackAccountCode: '4070' },
  { key: 'WHOLESALE_SALES_REVENUE', fallbackAccountCode: '4080' },
  { key: 'RETAIL_SALES_REVENUE', fallbackAccountCode: '4090' },
  { key: 'DISCOUNT_ALLOWED', fallbackAccountCode: '4100' },
  { key: 'SALES_RETURNS', fallbackAccountCode: '4110' },
  { key: 'COST_OF_GOODS_SOLD', fallbackAccountCode: '5110', notes: 'Dedicated posting child added for generic cost-of-sales postings.' },
  { key: 'RAW_MATERIALS_CONSUMED', fallbackAccountCode: '5010' },
  { key: 'PACKAGING_COST', fallbackAccountCode: '5020' },
  { key: 'PRODUCTION_LABOUR', fallbackAccountCode: '5060' },
  { key: 'PRODUCTION_OVERHEAD', fallbackAccountCode: '5070' },
  { key: 'INVENTORY_WRITE_OFF', fallbackAccountCode: '5090' },
  { key: 'PRODUCTION_VARIANCE', fallbackAccountCode: '5100' },
  { key: 'EXCHANGE_GAIN', fallbackAccountCode: '7040' },
  { key: 'EXCHANGE_LOSS', fallbackAccountCode: '8020' },
] as const;

export function normalizeFinanceFoundationType(value: string | null | undefined): FinanceAccountType {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if ((FINANCE_ACCOUNT_TYPES as readonly string[]).includes(normalized)) {
    return normalized as FinanceAccountType;
  }

  return 'EXPENSE';
}

export function getFinanceNormalBalance(type: string | null | undefined): FinanceNormalBalance {
  switch (normalizeFinanceFoundationType(type)) {
    case 'ASSET':
    case 'EXPENSE':
    case 'COST_OF_SALES':
    case 'CONTRA_REVENUE':
      return 'DEBIT';
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
    case 'OTHER_INCOME':
    case 'CONTRA_ASSET':
      return 'CREDIT';
    default:
      return null;
  }
}

export function isHeaderAccountType(type: string | null | undefined) {
  return normalizeFinanceFoundationType(type) === 'HEADER';
}

export function defaultFinanceAccountPostingFlag(type: string | null | undefined) {
  return !isHeaderAccountType(type);
}

export function canFinanceAccountReceivePosting(account: {
  accountCode?: string | null;
  accountName?: string | null;
  accountType?: string | null;
  allowPosting?: boolean | null;
  isActive?: boolean | null;
}) {
  const isActive = account.isActive !== false;
  if (!isActive) {
    return `${String(account.accountCode ?? account.accountName ?? 'Account')} is inactive.`;
  }

  const allowPosting = account.allowPosting ?? defaultFinanceAccountPostingFlag(account.accountType);
  if (!allowPosting || isHeaderAccountType(account.accountType)) {
    return `${String(account.accountCode ?? account.accountName ?? 'Account')} is a header account and cannot receive postings.`;
  }

  return null;
}

export function normalizeFinanceAccountRecord(row: Record<string, unknown>): FinanceAccountRecord {
  const accountType = normalizeFinanceFoundationType(
    String(row.account_type ?? row.type ?? row.accountType ?? 'EXPENSE'),
  );
  const allowPostingValue = row.allow_posting ?? row.allowPosting;
  const allowPosting =
    typeof allowPostingValue === 'boolean'
      ? allowPostingValue
      : defaultFinanceAccountPostingFlag(accountType);
  const parentAccountCode =
    row.parent_account_code != null
      ? String(row.parent_account_code)
      : row.parentCode != null
        ? String(row.parentCode)
        : null;

  return {
    accountCode: String(row.account_code ?? row.code ?? row.accountCode ?? ''),
    accountName: String(row.account_name ?? row.name ?? row.accountName ?? ''),
    accountType,
    allowPosting,
    currentBalance: toNumber(row.current_balance ?? row.balance ?? row.currentBalance ?? 0),
    description: row.description ? String(row.description) : null,
    id: String(row.id ?? ''),
    isActive: row.is_active !== false && row.isActive !== false,
    normalBalance: row.normal_balance
      ? String(row.normal_balance).toUpperCase() as FinanceNormalBalance
      : getFinanceNormalBalance(accountType),
    organizationId: row.organization_id ? String(row.organization_id) : row.organizationId ? String(row.organizationId) : null,
    parentAccountCode,
    parentAccountId: row.parent_account_id
      ? String(row.parent_account_id)
      : row.parent_id
        ? String(row.parent_id)
        : row.parentAccountId
          ? String(row.parentAccountId)
          : null,
  };
}

export function buildFinanceAccountTree(accounts: FinanceAccountRecord[]) {
  const nodes = accounts.map((account) => ({
    ...account,
    children: [] as FinanceAccountTreeNode[],
    depth: 0,
    path: [account.accountCode],
  }));
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const roots: FinanceAccountTreeNode[] = [];

  for (const node of nodes) {
    if (node.parentAccountId && byId.has(node.parentAccountId)) {
      const parent = byId.get(node.parentAccountId)!;
      node.depth = parent.depth + 1;
      node.path = [...parent.path, node.accountCode];
      parent.children.push(node);
      continue;
    }

    roots.push(node);
  }

  const sortNodes = (items: FinanceAccountTreeNode[]) => {
    items.sort((left, right) => left.accountCode.localeCompare(right.accountCode));
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

export function flattenFinanceAccountTree(nodes: FinanceAccountTreeNode[]): FinanceAccountTreeNode[] {
  const rows: FinanceAccountTreeNode[] = [];

  const visit = (node: FinanceAccountTreeNode) => {
    rows.push(node);
    node.children.forEach(visit);
  };

  nodes.forEach(visit);
  return rows;
}

export function filterFinanceAccounts(
  accounts: FinanceAccountRecord[],
  options?: {
    activeStatus?: 'active' | 'all' | 'inactive';
    search?: string | null;
    type?: string | null;
  },
) {
  const needle = String(options?.search ?? '').trim().toLowerCase();
  const type = options?.type ? normalizeFinanceFoundationType(options.type) : null;
  const activeStatus = options?.activeStatus ?? 'all';

  return accounts.filter((account) => {
    if (type && account.accountType !== type) return false;
    if (activeStatus === 'active' && !account.isActive) return false;
    if (activeStatus === 'inactive' && account.isActive) return false;
    if (!needle) return true;

    return (
      account.accountCode.toLowerCase().includes(needle) ||
      account.accountName.toLowerCase().includes(needle) ||
      String(account.description ?? '').toLowerCase().includes(needle)
    );
  });
}

export function validateOpeningBalanceDraftLines(lines: OpeningBalanceDraftLine[]) {
  const normalizedLines = lines.filter((line) => {
    const debit = ensureNonNegative(line.debitAmount ?? 0, 'debitAmount');
    const credit = ensureNonNegative(line.creditAmount ?? 0, 'creditAmount');
    return Boolean(line.accountId ?? line.accountCode) && (debit > 0 || credit > 0);
  });

  if (normalizedLines.length < 2) {
    return 'Opening balances require at least two lines.';
  }

  const totalDebit = normalizedLines.reduce((sum, line) => sum + ensureNonNegative(line.debitAmount, 'debitAmount'), 0);
  const totalCredit = normalizedLines.reduce((sum, line) => sum + ensureNonNegative(line.creditAmount, 'creditAmount'), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return 'Opening balances must balance before posting.';
  }

  return null;
}

export function buildBranchCostCentreCode(branch: { code?: string | null; name?: string | null }) {
  const preferred = String(branch.code ?? '').trim() || String(branch.name ?? '').trim();
  return preferred
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function buildBranchCostCentreDefinitions(
  branches: Array<{ code?: string | null; id: string; name?: string | null }>,
) {
  return branches
    .filter((branch) => String(branch.id ?? '').trim())
    .map((branch) => ({
      branchId: String(branch.id),
      code: `BRANCH_${buildBranchCostCentreCode(branch) || 'UNSPECIFIED'}`,
      name: String(branch.name ?? branch.code ?? 'Unnamed Branch'),
      parentCode: 'SALES',
    }));
}

export function countPostingAccounts(definitions = OFFICIAL_CHART_OF_ACCOUNTS) {
  return definitions.filter((definition) => definition.allowPosting ?? defaultFinanceAccountPostingFlag(definition.type)).length;
}

export function countHeaderAccounts(definitions = OFFICIAL_CHART_OF_ACCOUNTS) {
  return definitions.filter((definition) => isHeaderAccountType(definition.type)).length;
}
