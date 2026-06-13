import { ensureNonNegative, toCsv, toNumber } from './inventory';

export function calculateFailedQuantity(quantityInspected: number, quantityPassed: number) {
  return Math.max(
    0,
    ensureNonNegative(quantityInspected, 'quantityInspected') -
      ensureNonNegative(quantityPassed, 'quantityPassed'),
  );
}

export function calculateFailureRate(quantityInspected: number, quantityFailed: number) {
  const inspected = ensureNonNegative(quantityInspected, 'quantityInspected');
  const failed = ensureNonNegative(quantityFailed, 'quantityFailed');
  return inspected === 0 ? 0 : (failed / inspected) * 100;
}

export function calculateReusablePercentage(returnedQuantity: number, reusableQuantity: number) {
  const returned = ensureNonNegative(returnedQuantity, 'returnedQuantity');
  const reusable = ensureNonNegative(reusableQuantity, 'reusableQuantity');
  return returned === 0 ? 0 : (reusable / returned) * 100;
}

export function calculateDamageValue(quantity: number, unitCost: number) {
  return ensureNonNegative(quantity, 'quantity') * ensureNonNegative(unitCost, 'unitCost');
}

export function calculateExpiredGoodsValue(quantity: number, unitCost: number) {
  return calculateDamageValue(quantity, unitCost);
}

export function calculateWasteValue(quantity: number, unitCost: number) {
  return calculateDamageValue(quantity, unitCost);
}

export function calculateReturnRate(returnedQuantity: number, dispatchedQuantity: number) {
  const dispatched = ensureNonNegative(dispatchedQuantity, 'dispatchedQuantity');
  const returned = ensureNonNegative(returnedQuantity, 'returnedQuantity');
  return dispatched === 0 ? 0 : (returned / dispatched) * 100;
}

export function validateInspectionQuantities(quantityInspected: number, quantityPassed: number, quantityFailed: number) {
  const inspected = ensureNonNegative(quantityInspected, 'quantityInspected');
  const passed = ensureNonNegative(quantityPassed, 'quantityPassed');
  const failed = ensureNonNegative(quantityFailed, 'quantityFailed');
  if (inspected <= 0) return 'quantityInspected must be greater than zero';
  if (passed > inspected) return 'quantityPassed must not exceed quantityInspected';
  if (failed > inspected) return 'quantityFailed must not exceed quantityInspected';
  return null;
}

export function validateReturnClassification(input: {
  quantityDamaged: number;
  quantityExpired: number;
  quantityReturned: number;
  quantityReusable: number;
  quantityRework: number;
  quantityWaste: number;
}) {
  const returned = ensureNonNegative(input.quantityReturned, 'quantityReturned');
  const total =
    ensureNonNegative(input.quantityReusable, 'quantityReusable') +
    ensureNonNegative(input.quantityDamaged, 'quantityDamaged') +
    ensureNonNegative(input.quantityExpired, 'quantityExpired') +
    ensureNonNegative(input.quantityRework, 'quantityRework') +
    ensureNonNegative(input.quantityWaste, 'quantityWaste');
  if (returned <= 0) return 'quantityReturned must be greater than zero';
  if (total > returned) return 'classification totals must not exceed quantityReturned';
  return null;
}

export function buildQualityImportTemplate(type: 'market-findings' | 'templates') {
  if (type === 'market-findings') {
    return toCsv([
      {
        findingType: 'TEMPERATURE',
        notes: '',
        productName: '',
        recommendation: '',
      },
    ]);
  }

  return toCsv([
    {
      activeStatus: true,
      expectedStandard: '',
      inspectionType: 'RAW_MATERIAL_RECEIPT',
      maximumValue: '',
      minimumValue: '',
      parameterName: '',
      requiredFlag: true,
      templateName: '',
    },
  ]);
}

type QualityValidationResult<T extends Record<string, unknown>> = {
  errors: Array<{ message: string; rowNumber: number }>;
  rows: T[];
};

export function validateQualityTemplateImportRows(
  rows: Array<Record<string, unknown>>,
): QualityValidationResult<Record<string, unknown>> {
  const errors: QualityValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];
  const validTypes = new Set([
    'RAW_MATERIAL_RECEIPT',
    'PRODUCTION_BATCH',
    'FINISHED_GOODS',
    'CUSTOMER_RETURN',
    'BRANCH_RETURN',
    'SUPPLIER_RETURN',
    'DAMAGED_GOODS',
    'MARKET_REPORT',
  ]);

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const templateName = String(row.templateName ?? '').trim();
    const inspectionType = String(row.inspectionType ?? '').trim();
    const parameterName = String(row.parameterName ?? '').trim();
    const minimumValue = row.minimumValue === '' || row.minimumValue == null ? null : toNumber(row.minimumValue, NaN);
    const maximumValue = row.maximumValue === '' || row.maximumValue == null ? null : toNumber(row.maximumValue, NaN);

    if (!templateName) errors.push({ message: 'templateName is required', rowNumber });
    if (!validTypes.has(inspectionType)) errors.push({ message: 'inspectionType is invalid', rowNumber });
    if (!parameterName) errors.push({ message: 'parameterName is required', rowNumber });
    if (minimumValue !== null && !Number.isFinite(minimumValue)) errors.push({ message: 'minimumValue must be numeric', rowNumber });
    if (maximumValue !== null && !Number.isFinite(maximumValue)) errors.push({ message: 'maximumValue must be numeric', rowNumber });

    if (templateName && validTypes.has(inspectionType) && parameterName) validRows.push(row);
  });

  return { errors, rows: validRows };
}
