import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { fetchGoodsReceivedNoteDetail, isGrnStockPostingError } from '@/lib/procurement-goods-received';
import { loadInventoryReversalSnapshots } from '@/lib/inventory-reversal-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateTheoreticalOutputFromBase } from '@/lib/production-raw-material-conversions';

async function enrichProductionConversionLines(service: ReturnType<typeof createServiceRoleClient>, data: Record<string, unknown>) {
  const lines = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const itemIds = [...new Set(lines.map((line) => String(line.item_id ?? line.itemId ?? '')).filter(Boolean))];
  if (!itemIds.length) return data;
  const [itemsResult, profilesResult] = await Promise.all([
    service.from('items').select('id, category_id, unit_id, unit_of_measure_id').in('id', itemIds),
    service.from('production_raw_material_conversions').select('*').in('item_id', itemIds).eq('is_active', true),
  ]);
  if (itemsResult.error || profilesResult.error) throw itemsResult.error ?? profilesResult.error;
  const categoryIds = [...new Set((itemsResult.data ?? []).map((item) => String(item.category_id ?? '')).filter(Boolean))];
  const categoriesResult = categoryIds.length ? await service.from('item_categories').select('id, code').in('id', categoryIds) : { data: [], error: null };
  if (categoriesResult.error) throw categoriesResult.error;
  const items = new Map((itemsResult.data ?? []).map((item) => [String(item.id), item as Record<string, unknown>]));
  const categories = new Map((categoriesResult.data ?? []).map((category) => [String(category.id), String(category.code ?? '')]));
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [String(profile.item_id), profile as Record<string, unknown>]));
  const uomIds = [...new Set([...(profilesResult.data ?? []).flatMap((profile) => [profile.purchase_uom_id, profile.conversion_uom_id, profile.production_output_uom_id]), ...(itemsResult.data ?? []).flatMap((item) => [item.unit_of_measure_id, item.unit_id])].map(String).filter(Boolean))];
  const uomsResult = uomIds.length ? await service.from('units_of_measure').select('id, code, name, abbreviation').in('id', uomIds) : { data: [], error: null };
  if (uomsResult.error) throw uomsResult.error;
  const uoms = new Map((uomsResult.data ?? []).map((uom) => [String(uom.id), uom as Record<string, unknown>]));
  const posted = data.stockPosted === true || String(data.status ?? '').toUpperCase() === 'POSTED';
  const unit = (id: unknown) => { const uom = uoms.get(String(id)); return uom ? { id: String(uom.id), code: String(uom.code ?? uom.abbreviation ?? ''), name: String(uom.name ?? '') } : null; };
  const enriched = lines.map((line) => {
    const itemId = String(line.item_id ?? line.itemId ?? '');
    const item = items.get(itemId);
    const categoryCode = item ? categories.get(String(item.category_id ?? '')) ?? '' : '';
    if (categoryCode !== 'RAW_MATERIAL_PRODUCTION') return { ...line, categoryCode, productionConversionSummary: null };
    const baseQuantity = Number(line.base_quantity ?? line.baseQuantity ?? line.quantity ?? line.quantity_received ?? line.receivedQuantity ?? 0);
    const snapshotComplete = line.production_profile_id && line.production_output_uom_id && line.production_output_quantity_per_profile && line.production_profile_purchase_quantity && line.production_profile_conversion_quantity;
    if (posted && !snapshotComplete) return { ...line, categoryCode, productionConversionSnapshotIncomplete: true, productionConversionSummary: null };
    const profile = posted ? {
      conversion_quantity: line.production_profile_conversion_quantity, conversion_uom_id: item?.unit_of_measure_id ?? item?.unit_id,
      production_output_quantity: line.production_output_quantity_per_profile, production_output_uom_id: line.production_output_uom_id,
      purchase_quantity: line.production_profile_purchase_quantity, purchase_uom_id: line.transaction_uom_id ?? line.transactionUomId ?? line.unit_of_measure_id,
    } : profiles.get(itemId);
    if (!profile) return { ...line, categoryCode, productionConversionSummary: null };
    const summary = { purchaseQuantity: Number(profile.purchase_quantity), purchaseUom: unit(profile.purchase_uom_id), conversionQuantity: Number(profile.conversion_quantity), conversionUom: unit(profile.conversion_uom_id), productionOutputQuantity: Number(profile.production_output_quantity), productionOutputUom: unit(profile.production_output_uom_id), baseQuantity, potentialOutput: calculateTheoreticalOutputFromBase({ conversionQuantity: Number(profile.conversion_quantity), conversionUomId: String(profile.conversion_uom_id), productionOutputQuantity: Number(profile.production_output_quantity), productionOutputUomId: String(profile.production_output_uom_id), purchaseQuantity: Number(profile.purchase_quantity), purchaseUomId: String(profile.purchase_uom_id) }, baseQuantity), source: posted ? 'SNAPSHOT' : 'CURRENT_PROFILE' };
    return { ...line, categoryCode, productionConversionSummary: summary };
  });
  return { ...data, items: enriched, line_items: enriched, lineItems: enriched };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.view', 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  try {
    const detail = await fetchGoodsReceivedNoteDetail(service, {
      grnId: id,
      organizationId: ctx.organizationId,
    });
    const data = await enrichProductionConversionLines(service, detail as Record<string, unknown>);
    const reversalSnapshot = (await loadInventoryReversalSnapshots(service, 'goods_received_note', [id])).get(id)?.[0] ?? null;
    const reversal = reversalSnapshot
      ? {
          approvedBy: reversalSnapshot.approvedBy,
          approvedByName: reversalSnapshot.approvedByName,
          id: reversalSnapshot.id,
          originalJournalId: reversalSnapshot.originalJournalId,
          originalMovementIds: reversalSnapshot.originalMovementIds,
          postedAt: reversalSnapshot.postedAt,
          postedBy: reversalSnapshot.postedBy,
          postedByName: reversalSnapshot.postedByName,
          reason: reversalSnapshot.reason,
          requestedBy: reversalSnapshot.requestedBy,
          requestedByName: reversalSnapshot.requestedByName,
          reversalJournalId: reversalSnapshot.reversalJournalId,
          reversalJournalNumber: reversalSnapshot.reversalJournalNumber,
          reversalMovementIds: reversalSnapshot.movementIds,
          reversalNumber: reversalSnapshot.reversalNumber,
          reversalReference: reversalSnapshot.reversalReference,
          status: reversalSnapshot.status,
        }
      : null;

    return NextResponse.json({
      success: true,
      data,
      reversal,
      ...data,
    });
  } catch (error) {
    if (isGrnStockPostingError(error) && error.message === 'Goods received note not found.') {
      return notFound('Goods received note not found.');
    }

    return serverError(error instanceof Error ? error.message : 'Failed to load goods received note.');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.edit', 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    notes?: string | null;
    qualityNotes?: string | null;
    receivedDate?: string | null;
  };

  const { data: existing, error: existingError } = await service
    .from('goods_received_notes')
    .select('id, status')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (existingError) return serverError(existingError.message);
  if (!existing) return notFound('Goods received note not found.');
  if (String(existing.status ?? '').toUpperCase() !== 'DRAFT') {
    return badRequest('Only draft GRNs can be edited.');
  }

  const updates: Record<string, unknown> = {};
  if (body.notes !== undefined) updates.notes = body.notes ?? null;
  if (body.qualityNotes !== undefined) updates.quality_notes = body.qualityNotes ?? null;
  if (body.receivedDate !== undefined) updates.received_date = body.receivedDate ?? null;

  const { data, error } = await service
    .from('goods_received_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
