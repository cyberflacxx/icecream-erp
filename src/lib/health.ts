import { createServiceRoleClient } from '@/lib/supabase/server';

const HEALTH_APP_NAME = 'absolute-ice-cream-erp';
const DATABASE_TIMEOUT_MS = 1500;

type HealthCheckStatus = 'ok' | 'error';

export type HealthPayload = {
  success: boolean;
  app: string;
  status: 'ok' | 'degraded';
  timestamp: string;
  environment: string;
  checks: {
    frontend: HealthCheckStatus;
    api: HealthCheckStatus;
    database: HealthCheckStatus;
  };
};

function getEnvironmentName() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Database health check timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function checkDatabaseHealth() {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await withTimeout(
      supabase.from('users').select('id').limit(1),
      DATABASE_TIMEOUT_MS
    );

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: true,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown database health check error.',
    };
  }
}

export async function buildHealthPayload(): Promise<HealthPayload> {
  const database = await checkDatabaseHealth();

  return {
    success: database.ok,
    app: HEALTH_APP_NAME,
    status: database.ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: getEnvironmentName(),
    checks: {
      frontend: 'ok',
      api: 'ok',
      database: database.ok ? 'ok' : 'error',
    },
  };
}

export function buildLivePayload(): HealthPayload {
  return {
    success: true,
    app: HEALTH_APP_NAME,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: getEnvironmentName(),
    checks: {
      frontend: 'ok',
      api: 'ok',
      database: 'ok',
    },
  };
}
