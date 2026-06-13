import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAdmin } from '@/app/api/notifications/_helpers';
import { createEscalationRule, listEscalationRules } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse(await listEscalationRules(auth.ctx.organizationId));
  } catch (error) {
    return notificationError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    return notificationResponse(await createEscalationRule({ body, ctx: auth.ctx }), 201);
  } catch (error) {
    return notificationError(error);
  }
}
