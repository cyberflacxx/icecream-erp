import { ensureNonNegative, toNumber } from '@/lib/inventory';
import { normalizeUomConversionFactor } from '@/lib/uom';

export const RAW_MATERIAL_PRODUCTION_CATEGORY_CODE = 'RAW_MATERIAL_PRODUCTION';

export interface ProductionRawMaterialConversion {
  conversionQuantity: number;
  conversionUomId: string;
  id?: string;
  productionOutputQuantity: number;
  productionOutputUomId: string;
  purchaseQuantity: number;
  purchaseUomId: string;
}

function positive(value: unknown, label: string) {
  const number = toNumber(value, NaN);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function ratio(numerator: number, denominator: number) {
  return Number((BigInt(Math.round(numerator * 1_000_000)) * 1_000_000n) / BigInt(Math.round(denominator * 1_000_000))) / 1_000_000;
}

export function normalizeProductionRawMaterialConversion(input: ProductionRawMaterialConversion): ProductionRawMaterialConversion {
  if (!input.purchaseUomId || !input.conversionUomId || !input.productionOutputUomId) {
    throw new Error('Purchase, conversion, and production output UOMs are required.');
  }
  return { ...input, conversionQuantity: positive(input.conversionQuantity, 'Conversion quantity'), productionOutputQuantity: positive(input.productionOutputQuantity, 'Production output quantity'), purchaseQuantity: positive(input.purchaseQuantity, 'Purchase quantity') };
}

export function productionConversionFactor(profile: ProductionRawMaterialConversion) {
  const normalized = normalizeProductionRawMaterialConversion(profile);
  return normalizeUomConversionFactor(ratio(normalized.conversionQuantity, normalized.purchaseQuantity));
}

export function calculateBaseFromPurchase(profile: ProductionRawMaterialConversion, purchaseQuantity: unknown) {
  return ensureNonNegative(purchaseQuantity, 'purchaseQuantity') * productionConversionFactor(profile);
}

export function calculatePurchaseEquivalent(profile: ProductionRawMaterialConversion, baseQuantity: unknown) {
  const normalized = normalizeProductionRawMaterialConversion(profile);
  return ensureNonNegative(baseQuantity, 'baseQuantity') * ratio(normalized.purchaseQuantity, normalized.conversionQuantity);
}

export function calculateTheoreticalOutputFromBase(profile: ProductionRawMaterialConversion, baseQuantity: unknown) {
  const normalized = normalizeProductionRawMaterialConversion(profile);
  return ensureNonNegative(baseQuantity, 'baseQuantity') * ratio(normalized.productionOutputQuantity, normalized.conversionQuantity);
}

export function calculateTheoreticalOutputFromPurchase(profile: ProductionRawMaterialConversion, purchaseQuantity: unknown) {
  return calculateTheoreticalOutputFromBase(profile, calculateBaseFromPurchase(profile, purchaseQuantity));
}

export function calculateYieldVariance(actualOutput: unknown, theoreticalOutput: unknown) {
  const actual = ensureNonNegative(actualOutput, 'actualOutput');
  const theoretical = ensureNonNegative(theoreticalOutput, 'theoreticalOutput');
  return { variance: actual - theoretical, yieldPercentage: theoretical > 0 ? (actual / theoretical) * 100 : null };
}

export function isProductionRawMaterialCategory(categoryCode: unknown) {
  return String(categoryCode ?? '').trim().toUpperCase() === RAW_MATERIAL_PRODUCTION_CATEGORY_CODE;
}

export type ProductionConversionPayload = ProductionRawMaterialConversion | null | undefined;

export function productionConversionPayload(input: ProductionConversionPayload) {
  if (!input) return null;
  const profile = normalizeProductionRawMaterialConversion(input);
  return {
    conversion_quantity: profile.conversionQuantity,
    conversion_uom_id: profile.conversionUomId,
    production_output_quantity: profile.productionOutputQuantity,
    production_output_uom_id: profile.productionOutputUomId,
    purchase_quantity: profile.purchaseQuantity,
    purchase_uom_id: profile.purchaseUomId,
  };
}

export function mapProductionConversion(row: Record<string, unknown>, units: Map<string, Record<string, unknown>>) {
  const unit = (id: unknown) => {
    const value = String(id ?? '');
    const item = units.get(value) ?? {};
    return { abbreviation: String(item.abbreviation ?? ''), id: value, name: String(item.name ?? '') };
  };
  return {
    conversionQuantity: Number(row.conversion_quantity ?? 0),
    conversionUom: unit(row.conversion_uom_id),
    id: String(row.id ?? ''),
    isActive: row.is_active !== false,
    productionOutputQuantity: Number(row.production_output_quantity ?? 0),
    productionOutputUom: unit(row.production_output_uom_id),
    purchaseQuantity: Number(row.purchase_quantity ?? 0),
    purchaseUom: unit(row.purchase_uom_id),
  };
}
