import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateQualityReferenceNumber, qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('market_quality_reports').select('*, market_report_findings(*)').eq('organization_id', ctx.organizationId).order('visit_date', { ascending: false });
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
    const body = await request.json() as {
      customerFeedback?: string;
      findings?: Array<{ findingType: string; notes: string; productName?: string; recommendation?: string }>;
      marketLocation: string;
      productCondition?: string;
      productsChecked?: string;
      qualityIssueFound?: string;
      recommendedAction?: string;
      visitDate: string;
    };
    if (!body.marketLocation || !body.visitDate) return badRequest('marketLocation and visitDate are required');
    const reportNumber = await generateQualityReferenceNumber('market_quality_reports', 'MQR');
    const service = qualityService();
    const { data, error } = await service.from('market_quality_reports').insert({
      organization_id: ctx.organizationId,
      report_number: reportNumber,
      market_location: body.marketLocation,
      visit_date: body.visitDate,
      visited_by: ctx.userId,
      products_checked: body.productsChecked ?? null,
      customer_feedback: body.customerFeedback ?? null,
      product_condition: body.productCondition ?? null,
      quality_issue_found: body.qualityIssueFound ?? null,
      recommended_action: body.recommendedAction ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    if ((body.findings ?? []).length > 0) {
      await service.from('market_report_findings').insert(
        body.findings!.map((finding) => ({
          market_report_id: data.id,
          finding_type: finding.findingType,
          product_name: finding.productName ?? null,
          notes: finding.notes,
          recommendation: finding.recommendation ?? null,
        })),
      );
    }
    await writeQualityAuditLog('MARKET_REPORT_CREATED', data.id, ctx.userId, { reportNumber }, 'market_report');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
