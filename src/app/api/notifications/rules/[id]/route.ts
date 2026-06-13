import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAdmin } from '@/app/api/notifications/_helpers';
import { updateNotificationRule } from '@/lib/notifications-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { id } = await params;
    return notificationResponse(
      await updateNotificationRule({
        body,
        ctx: auth.ctx,
        id,
        requestMeta: {
          ipAddress: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent'),
        },
      }),
    );
  } catch (error) {
    return notificationError(error);
  }
}
