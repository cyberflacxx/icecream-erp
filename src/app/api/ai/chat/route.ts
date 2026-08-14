import { NextRequest, NextResponse } from 'next/server';

import { forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { canAccessAbsoluteAi, runAbsoluteAiChat } from '@/lib/ai/service';
import { absoluteAiChatRequestSchema } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return unauthorized();
  if (!canAccessAbsoluteAi(auth)) return forbidden();

  const body = absoluteAiChatRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({
      error: {
        code: 'INVALID_AI_REQUEST',
        message: 'Absolute AI request body is invalid.',
      },
      success: false,
    }, { status: 400 });
  }

  try {
    const result = await runAbsoluteAiChat({ auth, body: body.data });
    return NextResponse.json({ success: true, ...result }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const status = Number((error as { status?: unknown }).status ?? 500) || 500;
    return NextResponse.json({
      error: {
        code: status === 429 ? 'ABSOLUTE_AI_RATE_LIMITED' : 'ABSOLUTE_AI_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Absolute AI is unavailable right now.',
      },
      success: false,
    }, { status });
  }
}
