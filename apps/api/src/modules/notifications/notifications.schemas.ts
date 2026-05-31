import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  unreadOnly: z.coerce.boolean().optional()
});

export const notificationIdParamsSchema = z.object({
  id: uuidSchema
});
