import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAdmin } from '@/app/api/notifications/_helpers';
import { updateReminderRule } from '@/lib/notifications-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { id } = await params;
    return notificationResponse(await updateReminderRule({ body, ctx: auth.ctx, id }));
  } catch (error) {
    return notificationError(error);
  }
}
