"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBudgetVariance = calculateBudgetVariance;
exports.calculateJournalBalance = calculateJournalBalance;
exports.validateJournalLines = validateJournalLines;
exports.calculateStraightLineDepreciation = calculateStraightLineDepreciation;
exports.calculateProductionCostSummary = calculateProductionCostSummary;
exports.calculateBranchCostSummary = calculateBranchCostSummary;
exports.calculateReceivableBalance = calculateReceivableBalance;
exports.calculatePayableBalance = calculatePayableBalance;
exports.calculateInventoryValuation = calculateInventoryValuation;
exports.calculatePettyCashBalance = calculatePettyCashBalance;
exports.resolvePettyCashAmount = resolvePettyCashAmount;
exports.normalizePettyCashRequest = normalizePettyCashRequest;
exports.resolveCashAccountBalance = resolveCashAccountBalance;
exports.normalizeCashAccount = normalizeCashAccount;
exports.normalizeFinanceCollectionResponse = normalizeFinanceCollectionResponse;
exports.resolveFinanceTransactionDate = resolveFinanceTransactionDate;
exports.resolveFinanceTransactionReference = resolveFinanceTransactionReference;
exports.resolveFinanceTransactionDescription = resolveFinanceTransactionDescription;
exports.normalizeFinanceTransactionRow = normalizeFinanceTransactionRow;
exports.buildEmptyFinanceDashboardData = buildEmptyFinanceDashboardData;
exports.resolveFinanceSectionResult = resolveFinanceSectionResult;
exports.resolveLedgerDebit = resolveLedgerDebit;
exports.resolveLedgerCredit = resolveLedgerCredit;
exports.normalizeTrialBalanceRow = normalizeTrialBalanceRow;
exports.summarizeTrialBalance = summarizeTrialBalance;
exports.summarizeProfitAndLoss = summarizeProfitAndLoss;
exports.buildFinanceSourceReference = buildFinanceSourceReference;
exports.parseFinanceSourceReference = parseFinanceSourceReference;
exports.isPostedJournalStatus = isPostedJournalStatus;
exports.normalizeFinanceAccountType = normalizeFinanceAccountType;
exports.isCostOfSalesAccount = isCostOfSalesAccount;
exports.summarizeBalanceSheetFromLedger = summarizeBalanceSheetFromLedger;
exports.summarizeProfitAndLossFromLedger = summarizeProfitAndLossFromLedger;
exports.summarizeCashFlowFromLedger = summarizeCashFlowFromLedger;
exports.buildReceivablesRows = buildReceivablesRows;
exports.buildPayablesRows = buildPayablesRows;
exports.buildFinanceReportCsv = buildFinanceReportCsv;
exports.buildFinanceImportTemplate = buildFinanceImportTemplate;
exports.validateBudgetImportRows = validateBudgetImportRows;
exports.validateFixedAssetImportRows = validateFixedAssetImportRows;
exports.validateBankAccountImportRows = validateBankAccountImportRows;
exports.validateChartOfAccountImportRows = validateChartOfAccountImportRows;
exports.validateOpeningBalanceImportRows = validateOpeningBalanceImportRows;
const inventory_1 = require("./inventory");
function calculateBudgetVariance(budgetedAmount, actualAmount) {
    const budgeted = (0, inventory_1.ensureNonNegative)(budgetedAmount, 'budgetedAmount');
    const actual = (0, inventory_1.ensureNonNegative)(actualAmount, 'actualAmount');
    const variance = actual - budgeted;
    const variancePct = budgeted === 0 ? 0 : (variance / budgeted) * 100;
    return { variance, variancePct };
}
function calculateJournalBalance(lines) {
    const totalDebit = lines.reduce((sum, line) => sum + (0, inventory_1.ensureNonNegative)(Number(line.debitAmount) || 0, 'debitAmount'), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (0, inventory_1.ensureNonNegative)(Number(line.creditAmount) || 0, 'creditAmount'), 0);
    return {
        isBalanced: Math.abs(totalDebit - totalCredit) <= 0.01,
        totalCredit,
        totalDebit,
        variance: totalDebit - totalCredit,
    };
}
function validateJournalLines(lines) {
    if (lines.length < 2)
        return 'Journal entry must have at least 2 lines';
    for (const line of lines) {
        const debit = Number(line.debitAmount) || 0;
        const credit = Number(line.creditAmount) || 0;
        if (debit <= 0 && credit <= 0)
            return 'Each line must contain a debit or credit amount greater than zero';
        if (debit > 0 && credit > 0)
            return 'A journal line cannot contain both debit and credit values';
    }
    const balance = calculateJournalBalance(lines);
    return balance.isBalanced
        ? null
        : `Journal entry is not balanced. Debit: ${balance.totalDebit.toFixed(2)}, Credit: ${balance.totalCredit.toFixed(2)}`;
}
function calculateStraightLineDepreciation(purchaseCost, residualValue, usefulLifeYears, periodsPerYear = 12) {
    const cost = (0, inventory_1.ensureNonNegative)(purchaseCost, 'purchaseCost');
    const residual = (0, inventory_1.ensureNonNegative)(residualValue, 'residualValue');
    const usefulLife = (0, inventory_1.ensureNonNegative)(usefulLifeYears, 'usefulLifeYears');
    if (usefulLife === 0 || periodsPerYear <= 0) {
        throw new Error('usefulLifeYears and periodsPerYear must be greater than zero');
    }
    const depreciableBase = Math.max(0, cost - residual);
    const annualDepreciation = depreciableBase / usefulLife;
    const periodicDepreciation = annualDepreciation / periodsPerYear;
    return {
        annualDepreciation,
        depreciableBase,
        periodicDepreciation,
    };
}
function calculateProductionCostSummary(materialCost, labourCost, overheadCost, outputQuantity) {
    const totalCost = (0, inventory_1.ensureNonNegative)(materialCost, 'materialCost') +
        (0, inventory_1.ensureNonNegative)(labourCost, 'labourCost') +
        (0, inventory_1.ensureNonNegative)(overheadCost, 'overheadCost');
    const quantity = (0, inventory_1.ensureNonNegative)(outputQuantity, 'outputQuantity');
    return {
        costPerUnit: quantity > 0 ? totalCost / quantity : 0,
        labourCost: (0, inventory_1.ensureNonNegative)(labourCost, 'labourCost'),
        materialCost: (0, inventory_1.ensureNonNegative)(materialCost, 'materialCost'),
        overheadCost: (0, inventory_1.ensureNonNegative)(overheadCost, 'overheadCost'),
        outputQuantity: quantity,
        totalCost,
    };
}
function calculateBranchCostSummary(salesAmount, costOfGoodsSold, branchExpenses, returnsValue = 0) {
    const revenue = (0, inventory_1.ensureNonNegative)(salesAmount, 'salesAmount');
    const cogs = (0, inventory_1.ensureNonNegative)(costOfGoodsSold, 'costOfGoodsSold');
    const expenses = (0, inventory_1.ensureNonNegative)(branchExpenses, 'branchExpenses');
    const returns = (0, inventory_1.ensureNonNegative)(returnsValue, 'returnsValue');
    const grossProfit = revenue - cogs - returns;
    const netProfit = grossProfit - expenses;
    return { grossProfit, netProfit };
}
function calculateReceivableBalance(invoiceTotal, amountPaid, creditNotes = 0) {
    const total = (0, inventory_1.ensureNonNegative)(invoiceTotal, 'invoiceTotal');
    const paid = (0, inventory_1.ensureNonNegative)(amountPaid, 'amountPaid');
    const credits = (0, inventory_1.ensureNonNegative)(creditNotes, 'creditNotes');
    return Math.max(0, total - paid - credits);
}
function calculatePayableBalance(invoiceTotal, amountPaid, debitNotes = 0) {
    const total = (0, inventory_1.ensureNonNegative)(invoiceTotal, 'invoiceTotal');
    const paid = (0, inventory_1.ensureNonNegative)(amountPaid, 'amountPaid');
    const debits = (0, inventory_1.ensureNonNegative)(debitNotes, 'debitNotes');
    return Math.max(0, total - paid - debits);
}
function calculateInventoryValuation(quantityOnHand, unitCost) {
    return (0, inventory_1.ensureNonNegative)(quantityOnHand, 'quantityOnHand') * (0, inventory_1.ensureNonNegative)(unitCost, 'unitCost');
}
function calculatePettyCashBalance(fundAmount, usedAmount) {
    return (0, inventory_1.ensureNonNegative)(fundAmount, 'fundAmount') - (0, inventory_1.ensureNonNegative)(usedAmount, 'usedAmount');
}
function resolvePettyCashAmount(row) {
    return (0, inventory_1.toNumber)(row.amount_requested ??
        row.requested_amount ??
        row.amount ??
        row.total_amount ??
        row.estimated_amount ??
        0);
}
function normalizePettyCashRequest(row) {
    const amountRequested = resolvePettyCashAmount(row);
    const amountApproved = (0, inventory_1.toNumber)(row.amount_approved ?? row.approved_amount ?? row.amountApproved ?? 0);
    const amountPaid = (0, inventory_1.toNumber)(row.amount_paid ?? row.paid_amount ?? row.amountPaid ?? 0);
    const branchId = row.branch_id ? String(row.branch_id) : row.branchId ? String(row.branchId) : null;
    const createdAt = row.created_at ? String(row.created_at) : row.createdAt ? String(row.createdAt) : null;
    const requestNumber = row.request_number
        ? String(row.request_number)
        : row.requestNumber
            ? String(row.requestNumber)
            : null;
    const requestDate = row.request_date ? String(row.request_date) : row.requestDate ? String(row.requestDate) : null;
    const requestedBy = row.requested_by ? String(row.requested_by) : row.requestedBy ? String(row.requestedBy) : null;
    const status = String(row.status ?? 'PENDING').toUpperCase();
    return {
        amountApproved,
        amountPaid,
        amountRequested,
        amount_approved: amountApproved,
        amount_paid: amountPaid,
        amount_requested: amountRequested,
        branchId,
        branch_id: branchId,
        createdAt,
        created_at: createdAt,
        id: String(row.id ?? ''),
        purpose: row.purpose ? String(row.purpose) : null,
        requestNumber,
        requestDate,
        request_number: requestNumber,
        request_date: requestDate,
        requestedBy,
        requested_by: requestedBy,
        status,
    };
}
function resolveCashAccountBalance(row) {
    return (0, inventory_1.toNumber)(row.current_balance ??
        row.balance ??
        row.opening_balance ??
        row.amount ??
        0);
}
function normalizeCashAccount(row) {
    const name = String(row.name ?? row.account_name ?? '');
    const accountName = String(row.account_name ?? row.name ?? '');
    const accountNumber = row.account_number ? String(row.account_number) : null;
    const balance = resolveCashAccountBalance(row);
    const branchId = row.branch_id ? String(row.branch_id) : row.branchId ? String(row.branchId) : null;
    const branch = row.branches;
    const branchRow = Array.isArray(branch) ? branch[0] ?? null : branch ?? null;
    const branchName = branchRow?.name ? String(branchRow.name) : null;
    const createdAt = row.created_at ? String(row.created_at) : row.createdAt ? String(row.createdAt) : null;
    const currency = row.currency_code ??
        row.currency ??
        row.currencyCode ??
        row.currencies?.code ??
        null;
    const openingBalance = (0, inventory_1.toNumber)(row.opening_balance ?? row.openingBalance ?? row.balance ?? 0);
    const isActive = row.is_active === undefined ? true : row.is_active !== false;
    const status = row.status !== undefined
        ? String(row.status).toUpperCase()
        : isActive
            ? 'ACTIVE'
            : 'INACTIVE';
    return {
        accountName,
        accountNumber,
        balance,
        branchId,
        branchName,
        createdAt,
        currencyCode: currency ? String(currency) : null,
        currentBalance: balance,
        id: String(row.id ?? ''),
        isActive,
        name,
        openingBalance,
        status,
    };
}
function normalizeFinanceCollectionResponse(response) {
    if (Array.isArray(response)) {
        return response;
    }
    if (!response || typeof response !== 'object') {
        return [];
    }
    const candidate = response;
    if (Array.isArray(candidate.data)) {
        return candidate.data;
    }
    return [];
}
function resolveFinanceTransactionDate(row) {
    return String(row.transaction_date ??
        row.entry_date ??
        row.date ??
        row.posted_at ??
        row.created_at ??
        '')
        .trim()
        .slice(0, 10);
}
function resolveFinanceTransactionReference(row) {
    return String(row.reference_number ??
        row.reference ??
        row.document_number ??
        row.transaction_number ??
        row.entry_number ??
        row.id ??
        '').trim();
}
function resolveFinanceTransactionDescription(row) {
    return String(row.description ??
        row.narration ??
        row.notes ??
        row.memo ??
        row.reference_type ??
        'Finance transaction').trim();
}
function normalizeFinanceTransactionRow(row) {
    const debit = resolveLedgerDebit(row);
    const credit = resolveLedgerCredit(row);
    const explicitAmount = (0, inventory_1.toNumber)(row.amount, Number.NaN);
    const amount = Number.isFinite(explicitAmount) ? explicitAmount : Math.abs(debit - credit) || debit || credit || 0;
    const reference = resolveFinanceTransactionReference(row);
    const date = resolveFinanceTransactionDate(row);
    const status = String(row.status ??
        ((row.is_posted === true || String(row.is_posted ?? '').toLowerCase() === 'true') ? 'POSTED' : 'DRAFT')).trim();
    return {
        accountCode: String(row.account_code ?? row.code ?? row.gl_code ?? row.number ?? '').trim(),
        accountName: String(row.account_name ?? row.name ?? row.title ?? '').trim(),
        amount,
        credit,
        date,
        debit,
        description: resolveFinanceTransactionDescription(row),
        id: String(row.id ?? '').trim(),
        reference,
        referenceNumber: reference,
        referenceType: String(row.reference_type ?? row.type ?? row.source ?? '').trim(),
        source: String(row.source ?? row.source_document ?? 'Finance Transaction').trim(),
        status,
        transactionDate: date,
    };
}
function buildEmptyFinanceDashboardData() {
    return {
        charts: {
            cashflowLast7Days: [],
            paymentMethodBreakdown: [],
        },
        overdueInvoices: [],
        recentEntries: [],
        stats: {
            bankBalance: 0,
            branchProfitability: 0,
            cashBalance: 0,
            grossProfit: 0,
            netProfit: 0,
            outstandingPayables: 0,
            outstandingReceivables: 0,
            paymentsCount: 0,
            pendingApprovals: 0,
            pettyCashBalance: 0,
            productionCost: 0,
            revenue: 0,
            stockValuation: 0,
            totalExpenses: 0,
        },
    };
}
function resolveFinanceSectionResult(result, fallbackValue, warning) {
    if (result.status === 'fulfilled') {
        return {
            value: result.value,
            warning: null,
        };
    }
    return {
        value: fallbackValue,
        warning,
    };
}
function resolveLedgerDebit(row) {
    const explicitDebit = (0, inventory_1.toNumber)(row.debit_amount ?? row.debit ?? row.debit_value, Number.NaN);
    if (Number.isFinite(explicitDebit)) {
        return explicitDebit;
    }
    const amount = (0, inventory_1.toNumber)(row.amount, 0);
    const side = String(row.debit_credit ?? row.side ?? '').trim().toUpperCase();
    return side === 'DEBIT' || side === 'DR' ? amount : 0;
}
function resolveLedgerCredit(row) {
    const explicitCredit = (0, inventory_1.toNumber)(row.credit_amount ?? row.credit ?? row.credit_value, Number.NaN);
    if (Number.isFinite(explicitCredit)) {
        return explicitCredit;
    }
    const amount = (0, inventory_1.toNumber)(row.amount, 0);
    const side = String(row.debit_credit ?? row.side ?? '').trim().toUpperCase();
    return side === 'CREDIT' || side === 'CR' ? amount : 0;
}
function normalizeTrialBalanceRow(row) {
    const debit = resolveLedgerDebit(row);
    const credit = resolveLedgerCredit(row);
    return {
        accountCode: String(row.account_code ?? row.code ?? row.gl_code ?? row.number ?? ''),
        accountId: String(row.account_id ?? row.id ?? ''),
        accountName: String(row.account_name ?? row.name ?? row.title ?? ''),
        accountType: normalizeFinanceAccountType(String(row.account_type ?? row.type ?? row.category ?? '')),
        balance: debit - credit,
        credit,
        debit,
    };
}
function summarizeTrialBalance(lines) {
    const grouped = new Map();
    for (const line of lines) {
        const key = `${line.accountCode}::${line.accountName}`;
        const current = grouped.get(key) ?? {
            accountCode: line.accountCode,
            accountName: line.accountName,
            credit: 0,
            debit: 0,
        };
        current.debit += Number(line.debitAmount) || 0;
        current.credit += Number(line.creditAmount) || 0;
        grouped.set(key, current);
    }
    const rows = [...grouped.values()];
    const totals = rows.reduce((sum, row) => ({ credit: sum.credit + row.credit, debit: sum.debit + row.debit }), { credit: 0, debit: 0 });
    return { rows, totals };
}
function summarizeProfitAndLoss(revenue, costOfGoodsSold, operatingExpenses) {
    const grossProfit = (0, inventory_1.ensureNonNegative)(revenue, 'revenue') - (0, inventory_1.ensureNonNegative)(costOfGoodsSold, 'costOfGoodsSold');
    const netProfit = grossProfit - (0, inventory_1.ensureNonNegative)(operatingExpenses, 'operatingExpenses');
    return { grossProfit, netProfit };
}
function buildFinanceSourceReference(sourceModule, sourceDocumentType, sourceDocumentId) {
    return [sourceModule, sourceDocumentType, sourceDocumentId]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(':');
}
function parseFinanceSourceReference(reference) {
    const normalized = String(reference ?? '').trim();
    if (!normalized)
        return null;
    const [sourceModule, sourceDocumentType, ...idParts] = normalized.split(':');
    const sourceDocumentId = idParts.join(':').trim();
    if (!sourceModule || !sourceDocumentType || !sourceDocumentId)
        return null;
    return { sourceModule, sourceDocumentType, sourceDocumentId };
}
function isPostedJournalStatus(status) {
    const normalized = String(status ?? '').trim().toUpperCase();
    return normalized === 'APPROVED' || normalized === 'POSTED';
}
function normalizeFinanceAccountType(value) {
    return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
}
function isCostOfSalesAccount(input) {
    const code = String(input.accountCode ?? '').trim().toUpperCase();
    const name = String(input.accountName ?? '').trim().toUpperCase();
    const type = normalizeFinanceAccountType(input.accountType);
    return (type === 'COST_OF_SALES' ||
        name.includes('COST OF GOODS SOLD') ||
        name.includes('COGS') ||
        code.startsWith('5'));
}
function summarizeBalanceSheetFromLedger(lines) {
    const totals = { assets: 0, equity: 0, liabilities: 0 };
    for (const line of lines) {
        const type = normalizeFinanceAccountType(line.accountType);
        const debit = (0, inventory_1.toNumber)(line.debitAmount);
        const credit = (0, inventory_1.toNumber)(line.creditAmount);
        const net = debit - credit;
        if (type === 'ASSET')
            totals.assets += net;
        if (type === 'LIABILITY')
            totals.liabilities += -net;
        if (type === 'EQUITY')
            totals.equity += -net;
    }
    return totals;
}
function summarizeProfitAndLossFromLedger(lines) {
    let revenue = 0;
    let costOfGoodsSold = 0;
    let operatingExpenses = 0;
    for (const line of lines) {
        const type = normalizeFinanceAccountType(line.accountType);
        const debit = (0, inventory_1.toNumber)(line.debitAmount);
        const credit = (0, inventory_1.toNumber)(line.creditAmount);
        if (type === 'REVENUE') {
            revenue += credit - debit;
            continue;
        }
        if (type === 'EXPENSE' || isCostOfSalesAccount(line)) {
            const amount = debit - credit;
            if (isCostOfSalesAccount(line))
                costOfGoodsSold += amount;
            else
                operatingExpenses += amount;
        }
    }
    return {
        ...summarizeProfitAndLoss(revenue, costOfGoodsSold, operatingExpenses),
        costOfGoodsSold,
        operatingExpenses,
        revenue,
    };
}
function summarizeCashFlowFromLedger(lines) {
    let cashIn = 0;
    let cashOut = 0;
    for (const line of lines) {
        const code = String(line.accountCode ?? '').trim().toUpperCase();
        const name = String(line.accountName ?? '').trim().toUpperCase();
        const isCashLike = name.includes('CASH') ||
            name.includes('BANK') ||
            code === '1000' ||
            code === '1010';
        if (!isCashLike)
            continue;
        cashIn += (0, inventory_1.toNumber)(line.debitAmount);
        cashOut += (0, inventory_1.toNumber)(line.creditAmount);
    }
    return {
        cashIn,
        cashOut,
        netCashFlow: cashIn - cashOut,
    };
}
function buildReceivablesRows(invoices) {
    return invoices.map((invoice) => ({
        balanceDue: (0, inventory_1.toNumber)(invoice.balance_due ?? invoice.balanceDue),
        customerName: String(invoice.customer_name ?? invoice.customerName ?? 'Walk-in'),
        dueDate: String(invoice.due_date ?? invoice.dueDate ?? ''),
        invoiceNumber: String(invoice.invoice_number ?? invoice.invoiceNumber ?? ''),
        status: String(invoice.status ?? ''),
        total: (0, inventory_1.toNumber)(invoice.total),
    }));
}
function buildPayablesRows(invoices) {
    return invoices.map((invoice) => ({
        balance: (0, inventory_1.toNumber)(invoice.balance ?? invoice.balance_due ?? invoice.amount_due),
        dueDate: String(invoice.due_date ?? invoice.dueDate ?? ''),
        invoiceNumber: String(invoice.invoice_number ?? invoice.invoiceNumber ?? ''),
        status: String(invoice.status ?? ''),
        supplierName: String(invoice.supplier_name ?? invoice.supplierName ?? 'Unknown supplier'),
        total: (0, inventory_1.toNumber)(invoice.total_amount ?? invoice.total ?? 0),
    }));
}
function buildFinanceReportCsv(rows) {
    return (0, inventory_1.toCsv)(rows);
}
function buildFinanceImportTemplate(type) {
    if (type === 'chart-of-accounts') {
        return (0, inventory_1.toCsv)([
            {
                accountCode: '',
                accountName: '',
                accountType: 'Asset',
                isActive: true,
                normalBalance: 'DEBIT',
                parentAccountCode: '',
            },
        ]);
    }
    if (type === 'budgets') {
        return (0, inventory_1.toCsv)([
            {
                accountCode: '',
                annualTotal: 0,
                branchCode: '',
                budgetCode: '',
                budgetName: '',
                budgetType: 'OPERATING',
                budgetYear: new Date().getFullYear(),
                departmentCode: '',
            },
        ]);
    }
    if (type === 'fixed-assets') {
        return (0, inventory_1.toCsv)([
            {
                assetCode: '',
                category: '',
                depreciationMethod: 'STRAIGHT_LINE',
                name: '',
                purchaseCost: 0,
                purchaseDate: '',
                residualValue: 0,
                usefulLifeYears: 5,
            },
        ]);
    }
    if (type === 'opening-balances') {
        return (0, inventory_1.toCsv)([
            {
                accountCode: '',
                amount: 0,
                balanceType: 'DEBIT',
                effectiveDate: '',
            },
        ]);
    }
    return (0, inventory_1.toCsv)([
        {
            accountCode: '',
            accountName: '',
            accountNumber: '',
            bankName: '',
            branchName: '',
            currency: 'USD',
        },
    ]);
}
function validateBudgetImportRows(rows) {
    const errors = [];
    const validRows = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const budgetCode = String(row.budgetCode ?? '').trim();
        const budgetName = String(row.budgetName ?? '').trim();
        const budgetYear = (0, inventory_1.toNumber)(row.budgetYear, NaN);
        const annualTotal = (0, inventory_1.toNumber)(row.annualTotal, NaN);
        if (!budgetCode)
            errors.push({ message: 'budgetCode is required', rowNumber });
        if (!budgetName)
            errors.push({ message: 'budgetName is required', rowNumber });
        if (!Number.isFinite(budgetYear) || budgetYear <= 0)
            errors.push({ message: 'budgetYear must be valid', rowNumber });
        if (!Number.isFinite(annualTotal) || annualTotal < 0)
            errors.push({ message: 'annualTotal must not be negative', rowNumber });
        if (budgetCode && budgetName && Number.isFinite(budgetYear) && annualTotal >= 0)
            validRows.push(row);
    });
    return { errors, rows: validRows };
}
function validateFixedAssetImportRows(rows) {
    const errors = [];
    const validRows = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const assetCode = String(row.assetCode ?? '').trim();
        const name = String(row.name ?? '').trim();
        const purchaseCost = (0, inventory_1.toNumber)(row.purchaseCost, NaN);
        const usefulLifeYears = (0, inventory_1.toNumber)(row.usefulLifeYears, NaN);
        if (!assetCode)
            errors.push({ message: 'assetCode is required', rowNumber });
        if (!name)
            errors.push({ message: 'name is required', rowNumber });
        if (!Number.isFinite(purchaseCost) || purchaseCost < 0)
            errors.push({ message: 'purchaseCost must not be negative', rowNumber });
        if (!Number.isFinite(usefulLifeYears) || usefulLifeYears <= 0)
            errors.push({ message: 'usefulLifeYears must be greater than zero', rowNumber });
        if (assetCode && name && purchaseCost >= 0 && usefulLifeYears > 0)
            validRows.push(row);
    });
    return { errors, rows: validRows };
}
function validateBankAccountImportRows(rows) {
    const errors = [];
    const validRows = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const accountCode = String(row.accountCode ?? '').trim();
        const accountName = String(row.accountName ?? '').trim();
        const accountNumber = String(row.accountNumber ?? '').trim();
        const bankName = String(row.bankName ?? '').trim();
        if (!accountCode)
            errors.push({ message: 'accountCode is required', rowNumber });
        if (!accountName)
            errors.push({ message: 'accountName is required', rowNumber });
        if (!accountNumber)
            errors.push({ message: 'accountNumber is required', rowNumber });
        if (!bankName)
            errors.push({ message: 'bankName is required', rowNumber });
        if (accountCode && accountName && accountNumber && bankName)
            validRows.push(row);
    });
    return { errors, rows: validRows };
}
function validateChartOfAccountImportRows(rows) {
    const errors = [];
    const validRows = [];
    const seenCodes = new Set();
    const validTypes = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'Cost of Sales']);
    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const accountCode = String(row.accountCode ?? '').trim();
        const accountName = String(row.accountName ?? '').trim();
        const accountType = String(row.accountType ?? '').trim();
        if (!accountCode)
            errors.push({ message: 'accountCode is required', rowNumber });
        if (!accountName)
            errors.push({ message: 'accountName is required', rowNumber });
        if (!validTypes.has(accountType))
            errors.push({ message: 'accountType is invalid', rowNumber });
        if (accountCode && seenCodes.has(accountCode))
            errors.push({ message: 'duplicate accountCode in import', rowNumber });
        seenCodes.add(accountCode);
        if (accountCode && accountName && validTypes.has(accountType) && !seenCodes.has(`invalid:${rowNumber}`)) {
            validRows.push(row);
        }
    });
    return { errors, rows: validRows };
}
function validateOpeningBalanceImportRows(rows) {
    const errors = [];
    const validRows = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const accountCode = String(row.accountCode ?? '').trim();
        const amount = (0, inventory_1.toNumber)(row.amount, NaN);
        const balanceType = String(row.balanceType ?? '').trim().toUpperCase();
        if (!accountCode)
            errors.push({ message: 'accountCode is required', rowNumber });
        if (!Number.isFinite(amount) || amount < 0)
            errors.push({ message: 'amount must not be negative', rowNumber });
        if (!['DEBIT', 'CREDIT'].includes(balanceType))
            errors.push({ message: 'balanceType must be DEBIT or CREDIT', rowNumber });
        if (accountCode && Number.isFinite(amount) && amount >= 0 && ['DEBIT', 'CREDIT'].includes(balanceType)) {
            validRows.push(row);
        }
    });
    return { errors, rows: validRows };
}
