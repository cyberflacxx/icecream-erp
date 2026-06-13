import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateProductionCodeUniqueness } from '@/lib/production';
import { generateReferenceNumber, productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service.from('production_flavours').select('*').order('name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as { code?: string; name?: string };
    if (!body.name?.trim()) return badRequest('Flavour name is required.');

    const service = productionService();
    const { data: existing, error: existingError } = await service.from('production_flavours').select('code');
    if (existingError) throw existingError;

    const code = body.code?.trim().toUpperCase() || await generateReferenceNumber('production_flavours', 'FLV');
    if (!validateProductionCodeUniqueness((existing ?? []).map((row: { code: string }) => row.code), code)) {
      return badRequest('Flavour code must be unique.');
    }

    const { data, error } = await service
      .from('production_flavours')
      .insert({ code, is_active: true, name: body.name.trim() })
      .select()
      .single();

    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_FLAVOUR_CREATED', String(data.id), ctx.userId, data, 'production_flavour');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
