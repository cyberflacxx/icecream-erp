import { z } from 'zod';

export const idSchema = z.string().uuid();
export const nameSchema = z.string().trim().min(2).max(120);
export const timestampSchema = z.string().datetime();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
