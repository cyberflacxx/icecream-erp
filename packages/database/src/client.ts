import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __absoluteIceCreamPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__absoluteIceCreamPrisma__ ??
  new PrismaClient({
    log: ['warn', 'error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__absoluteIceCreamPrisma__ = prisma;
}
