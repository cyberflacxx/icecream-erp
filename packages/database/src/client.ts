import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __absoluteIceCreamPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__absoluteIceCreamPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      : undefined
  });

const runtimeNodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
  ?.NODE_ENV;

if (runtimeNodeEnv !== 'production') {
  globalThis.__absoluteIceCreamPrisma__ = prisma;
}
