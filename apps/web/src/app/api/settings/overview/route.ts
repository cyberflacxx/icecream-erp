import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const DEFAULT_NUMBER_SERIES = {
  grnPrefix: 'GRN', invoicePrefix: 'INV', paymentPrefix: 'PAY',
  poPrefix: 'PO', requisitionPrefix: 'REQ', salesOrderPrefix: 'SO',
};

const DEFAULT_NOTIFICATION_SETTINGS = {
  expiryAlert: true, lowStock: true, paymentReceived: true,
  productionBatchReady: true, purchaseOrderApproved: true, shiftCloseSubmitted: true,
};

async function getSettingsBlob<T extends Record<string, unknown>>(
  service: ReturnType<typeof createServiceRoleClient>,
  referenceType: string,
  defaults: T,
): Promise<T> {
  const { data: record } = await service
    .schema('icecream_erp')
    .from('document_files')
    .select('file_url')
    .eq('reference_type', referenceType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record || !record.file_url?.startsWith('json://')) return defaults;
  try {
    const parsed = JSON.parse(decodeURIComponent(record.file_url.replace('json://', ''))) as T;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const { data: org } = await service
      .schema('icecream_erp')
      .from('organizations')
      .select('name, address, currency, email, phone, tax_number, logo_url')
      .limit(1)
      .maybeSingle();

    const [numberSeries, notificationSettings] = await Promise.all([
      getSettingsBlob(service, 'number_series', DEFAULT_NUMBER_SERIES),
      getSettingsBlob(service, 'notification_settings', DEFAULT_NOTIFICATION_SETTINGS),
    ]);

    return NextResponse.json({
      companyProfile: {
        name: org?.name ?? 'Absolute Quality Icecream',
        address: org?.address ?? null,
        currency: org?.currency ?? 'USD',
        email: org?.email ?? null,
        phone: org?.phone ?? null,
        taxNumber: org?.tax_number ?? null,
        logoUrl: org?.logo_url ?? null,
      },
      numberSeries,
      notificationSettings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      companyProfile?: {
        name?: string; address?: string; currency?: string;
        email?: string; phone?: string; taxNumber?: string; logoUrl?: string;
      };
      numberSeries?: Record<string, string>;
      notificationSettings?: Record<string, boolean>;
    };

    if (body.companyProfile) {
      const { companyProfile: cp } = body;
      const updateData: Record<string, unknown> = {};
      if (cp.name !== undefined) updateData.name = cp.name;
      if (cp.address !== undefined) updateData.address = cp.address;
      if (cp.currency !== undefined) updateData.currency = cp.currency;
      if (cp.email !== undefined) updateData.email = cp.email;
      if (cp.phone !== undefined) updateData.phone = cp.phone;
      if (cp.taxNumber !== undefined) updateData.tax_number = cp.taxNumber;
      if (cp.logoUrl !== undefined) updateData.logo_url = cp.logoUrl;

      if (Object.keys(updateData).length > 0) {
        // Upsert org settings
        const { data: existingOrg } = await service.schema('icecream_erp').from('organizations').select('id').limit(1).maybeSingle();
        if (existingOrg) {
          await service.schema('icecream_erp').from('organizations').update(updateData).eq('id', existingOrg.id);
        }
      }
    }

    async function saveSettingsBlob(referenceType: string, payload: Record<string, unknown>) {
      const content = JSON.stringify(payload);
      const fileUrl = `json://${encodeURIComponent(content)}`;
      const { data: existing } = await service
        .schema('icecream_erp')
        .from('document_files')
        .select('id')
        .eq('reference_type', referenceType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        await service.schema('icecream_erp').from('document_files').update({
          file_url: fileUrl,
          file_size: Buffer.byteLength(content, 'utf8'),
          file_type: 'application/json',
          uploaded_by: ctx.userId,
        }).eq('id', existing.id);
      } else {
        await service.schema('icecream_erp').from('document_files').insert({
          file_name: `${referenceType}.json`,
          file_url: fileUrl,
          file_size: Buffer.byteLength(content, 'utf8'),
          file_type: 'application/json',
          reference_type: referenceType,
          uploaded_by: ctx.userId,
        });
      }
    }

    if (body.numberSeries) await saveSettingsBlob('number_series', body.numberSeries);
    if (body.notificationSettings) await saveSettingsBlob('notification_settings', body.notificationSettings);

    // Re-fetch and return updated settings
    const { data: org } = await service
      .schema('icecream_erp')
      .from('organizations')
      .select('name, address, currency, email, phone, tax_number, logo_url')
      .limit(1)
      .maybeSingle();

    const [numberSeries, notificationSettings] = await Promise.all([
      getSettingsBlob(service, 'number_series', DEFAULT_NUMBER_SERIES),
      getSettingsBlob(service, 'notification_settings', DEFAULT_NOTIFICATION_SETTINGS),
    ]);

    return NextResponse.json({
      companyProfile: {
        name: org?.name ?? 'Absolute Quality Icecream',
        address: org?.address ?? null,
        currency: org?.currency ?? 'USD',
        email: org?.email ?? null,
        phone: org?.phone ?? null,
        taxNumber: org?.tax_number ?? null,
        logoUrl: org?.logo_url ?? null,
      },
      numberSeries,
      notificationSettings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
