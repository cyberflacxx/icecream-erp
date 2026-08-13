import { NextResponse } from 'next/server';

import { forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { canAccessAbsoluteAi, getAbsoluteAiHealthSummary } from '@/lib/ai/service';
import { getAbsoluteAiModel, getAbsoluteAiProviderName, isAbsoluteAiConfigured } from '@/lib/ai/provider';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();
  if (!canAccessAbsoluteAi(auth)) return forbidden();

  const summary = await getAbsoluteAiHealthSummary(auth);
  return NextResponse.json({
    configured: isAbsoluteAiConfigured(),
    model: getAbsoluteAiModel(),
    provider: getAbsoluteAiProviderName(),
    summary,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
