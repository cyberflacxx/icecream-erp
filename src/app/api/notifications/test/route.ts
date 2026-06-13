import { NextRequest } from 'next/server';

import { notificationError, notificationResponse, requireNotificationAdmin } from '@/app/api/notifications/_helpers';
import { emitNotificationEvent } from '@/lib/notifications-server';

export async function POST(request: NextRequest) {
  const auth = await requireNotificationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await emitNotificationEvent({
      actorUserId: auth.ctx.userId,
      branchId: body.branchId ? String(body.branchId) : null,
      channel: body.channel ? String(body.channel) : 'IN_APP',
      documentId: body.documentId ? String(body.documentId) : null,
      documentType: body.documentType ? String(body.documentType) : null,
      eventType: String(body.eventType ?? 'SYSTEM_TEST'),
      explicitMessage: String(body.message ?? 'Notification test event created.'),
      explicitTitle: String(body.title ?? 'Notification test'),
      metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
      moduleName: String(body.module ?? 'SYSTEM'),
      organizationId: auth.ctx.organizationId,
      recipientRoleNames: Array.isArray(body.recipientRoleNames) ? body.recipientRoleNames.map(String) : [],
      recipientUserIds: Array.isArray(body.recipientUserIds) ? body.recipientUserIds.map(String) : [auth.ctx.userId],
      severity: String(body.severity ?? 'INFO'),
      warehouseId: body.warehouseId ? String(body.warehouseId) : null,
    });
    return notificationResponse(result, 201);
  } catch (error) {
    return notificationError(error);
  }
}
