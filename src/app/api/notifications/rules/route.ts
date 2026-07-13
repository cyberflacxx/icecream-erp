import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAdmin } from '@/app/api/notifications/_helpers';
import { createNotificationRule, listNotificationRules } from '@/lib/notifications-server';

export async function GET(request: NextRequest) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    return notificationResponse(await listNotificationRules(auth.ctx.organizationId));
  } catch (error) {
    return notificationError(error, {
      fallbackData: [],
      routeName: '/api/notifications/rules',
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    return notificationResponse(
      await createNotificationRule({
        body,
        ctx: auth.ctx,
        requestMeta: {
          ipAddress: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent'),
        },
      }),
      201,
    );
  } catch (error) {
    return notificationError(error, {
      routeName: '/api/notifications/rules',
    });
  }
}
