import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('quality_check_templates').select('*, quality_check_parameters(*)').eq('organization_id', ctx.organizationId).order('template_name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const body = await request.json() as { inspectionType: string; parameters?: Array<Record<string, unknown>>; templateName: string };
    if (!body.templateName || !body.inspectionType) return badRequest('templateName and inspectionType are required');
    const service = qualityService();
    const { data, error } = await service.from('quality_check_templates').insert({
      organization_id: ctx.organizationId,
      template_name: body.templateName,
      inspection_type: body.inspectionType,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    if ((body.parameters ?? []).length > 0) {
      await service.from('quality_check_parameters').insert(
        body.parameters!.map((row) => ({
          template_id: data.id,
          parameter_name: row.parameterName,
          expected_standard: row.expectedStandard ?? null,
          minimum_value: row.minimumValue ?? null,
          maximum_value: row.maximumValue ?? null,
          required_flag: row.requiredFlag ?? true,
        })),
      );
    }
    await writeQualityAuditLog('QUALITY_TEMPLATE_CREATED', data.id, ctx.userId, { templateName: body.templateName }, 'quality_template');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
