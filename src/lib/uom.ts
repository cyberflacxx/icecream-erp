import { ensureNonNegative, ensurePositiveQuantity, toNumber } from './inventory';

export type UomDimension = 'CONTAINER' | 'COUNT' | 'GENERAL' | 'MASS' | 'VOLUME';

export interface UomLike {
  code?: unknown;
  id: string;
  unit_type?: unknown;
}

export interface UomConversionLike {
  active?: unknown;
  conversion_factor?: unknown;
  factor?: unknown;
  from_unit_id?: unknown;
  from_uom_id?: unknown;
  is_active?: unknown;
  item_id?: unknown;
  to_unit_id?: unknown;
  to_uom_id?: unknown;
}

export interface UomConversionResult {
  baseQuantity: number;
  baseUnitCost: number;
  baseUnitId: string;
  conversionFactor: number;
  transactionQuantity: number;
  transactionUnitCost: number;
  transactionUnitId: string;
}

const DECIMAL_SCALE = 1_000_000n;

export function normalizeUomDimension(value: unknown): UomDimension {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (['L', 'LITRE', 'LITER', 'ML', 'MILLILITRE', 'MILLILITER', 'VOLUME'].includes(normalized)) return 'VOLUME';
  if (['KG', 'KILOGRAM', 'G', 'GRAM', 'MASS', 'WEIGHT'].includes(normalized)) return 'MASS';
  if (['PCS', 'PIECE', 'PIECES', 'EA', 'EACH', 'COUNT'].includes(normalized)) return 'COUNT';
  if (['BUCKET', 'DRUM', 'CARTON', 'BOX', 'CONTAINER'].includes(normalized)) return 'CONTAINER';
  return normalized === 'GENERAL' || !normalized ? 'GENERAL' : 'GENERAL';
}

export function areUomDimensionsCompatible(input: {
  allowItemSpecificContainer?: boolean;
  from: Pick<UomLike, 'code' | 'unit_type'>;
  to: Pick<UomLike, 'code' | 'unit_type'>;
}) {
  const fromDimension = normalizeUomDimension(input.from.unit_type ?? input.from.code);
  const toDimension = normalizeUomDimension(input.to.unit_type ?? input.to.code);

  if (fromDimension === toDimension) return true;
  if (input.allowItemSpecificContainer && (fromDimension === 'CONTAINER' || toDimension === 'CONTAINER')) return true;
  if (fromDimension === 'GENERAL' || toDimension === 'GENERAL') return true;
  return false;
}

export function normalizeUomConversionFactor(value: unknown) {
  const factor = toNumber(value, NaN);
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('conversion factor must be greater than zero.');
  }
  return factor;
}

export function convertQuantity(quantity: unknown, conversionFactor: unknown) {
  const normalizedQuantity = ensureNonNegative(quantity, 'quantity');
  const normalizedFactor = normalizeUomConversionFactor(conversionFactor);
  return toScaledNumber(toScaledBigInt(normalizedQuantity) * toScaledBigInt(normalizedFactor) / DECIMAL_SCALE);
}

export function calculateBaseUnitCost(input: {
  baseQuantity: unknown;
  totalCost: unknown;
}) {
  const baseQuantity = ensurePositiveQuantity(input.baseQuantity, 'baseQuantity');
  const totalCost = ensureNonNegative(input.totalCost, 'totalCost');
  return toScaledNumber(toScaledBigInt(totalCost) * DECIMAL_SCALE / toScaledBigInt(baseQuantity));
}

export function resolveItemUomConversion(input: {
  conversions: UomConversionLike[];
  fromUnitId: string;
  itemId: string;
  toUnitId: string;
}) {
  if (input.fromUnitId === input.toUnitId) return 1;

  const activeConversions = input.conversions.filter((conversion) => conversion.is_active !== false && conversion.active !== false);
  const itemSpecific = activeConversions.find((conversion) =>
    String(conversion.item_id ?? '') === input.itemId &&
    String(conversion.from_unit_id ?? conversion.from_uom_id ?? '') === input.fromUnitId &&
    String(conversion.to_unit_id ?? conversion.to_uom_id ?? '') === input.toUnitId
  );
  if (itemSpecific) return normalizeUomConversionFactor(itemSpecific.conversion_factor ?? itemSpecific.factor);

  const generic = activeConversions.find((conversion) =>
    !String(conversion.item_id ?? '') &&
    String(conversion.from_unit_id ?? conversion.from_uom_id ?? '') === input.fromUnitId &&
    String(conversion.to_unit_id ?? conversion.to_uom_id ?? '') === input.toUnitId
  );
  if (generic) return normalizeUomConversionFactor(generic.conversion_factor ?? generic.factor);

  throw new Error('No active UOM conversion is configured for this item and unit pair.');
}

export function normalizeCommercialQuantityToBase(input: {
  baseUnitId: string;
  conversions: UomConversionLike[];
  itemId: string;
  quantity: unknown;
  totalCost?: unknown;
  transactionUnitId: string;
}) {
  const conversionFactor = resolveItemUomConversion({
    conversions: input.conversions,
    fromUnitId: input.transactionUnitId,
    itemId: input.itemId,
    toUnitId: input.baseUnitId,
  });
  const transactionQuantity = ensureNonNegative(input.quantity, 'quantity');
  const baseQuantity = convertQuantity(transactionQuantity, conversionFactor);
  const totalCost = input.totalCost == null ? 0 : ensureNonNegative(input.totalCost, 'totalCost');

  return {
    baseQuantity,
    baseUnitCost: totalCost > 0 ? calculateBaseUnitCost({ baseQuantity, totalCost }) : 0,
    baseUnitId: input.baseUnitId,
    conversionFactor,
    transactionQuantity,
    transactionUnitCost: transactionQuantity > 0 && totalCost > 0 ? totalCost / transactionQuantity : 0,
    transactionUnitId: input.transactionUnitId,
  } satisfies UomConversionResult;
}

export function subtractBaseQuantity(availableQuantity: unknown, requiredQuantity: unknown) {
  const available = ensureNonNegative(availableQuantity, 'availableQuantity');
  const required = ensureNonNegative(requiredQuantity, 'requiredQuantity');
  const remaining = toScaledNumber(toScaledBigInt(available) - toScaledBigInt(required));
  if (remaining < 0) throw new Error('Insufficient stock for requested base quantity.');
  return remaining;
}

function toScaledBigInt(value: number) {
  return BigInt(Math.round(value * Number(DECIMAL_SCALE)));
}

function toScaledNumber(value: bigint) {
  return Number(value) / Number(DECIMAL_SCALE);
}
