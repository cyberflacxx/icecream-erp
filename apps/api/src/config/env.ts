import { z } from 'zod';
import { resolve } from 'path';

const processWithEnvLoader = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

const envFileCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
  resolve(process.cwd(), '..', '..', '.env')
];

for (const envFilePath of envFileCandidates) {
  try {
    processWithEnvLoader.loadEnvFile?.(envFilePath);
  } catch {
    // Best-effort .env loading for local dev.
  }
}

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  ADMIN_KEY: z.string().default('AQI-ADMIN-2026'),
  CLERK_JWT_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  EMAIL_APP_NAME: z.string().default('Absolute Ice Cream ERP'),
  EMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_SECURE: booleanFromEnv.default(false),
  EMAIL_USER: z.string().optional(),
  JWT_EXPIRY: z.string().default('8h'),
  JWT_SECRET: z.string().min(16).default('change-this-jwt-secret-in-production'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  STORAGE_BUCKET: z.string().default('absolute-ice-cream-erp'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export const env = envSchema.parse({
  ADMIN_KEY: process.env.ADMIN_KEY,
  API_PORT: process.env.API_PORT,
  CLERK_JWT_KEY: process.env.CLERK_JWT_KEY,
  CLERK_PUBLISHABLE_KEY:
    process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  EMAIL_APP_NAME: process.env.EMAIL_APP_NAME,
  EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_SECURE: process.env.EMAIL_SECURE,
  EMAIL_USER: process.env.EMAIL_USER,
  JWT_EXPIRY: process.env.JWT_EXPIRY,
  JWT_SECRET: process.env.JWT_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  REDIS_URL: process.env.REDIS_URL,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NODE_ENV: process.env.NODE_ENV
});
