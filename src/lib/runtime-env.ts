const CANONICAL_APP_URL_ENV_KEYS = [
  'ABSOLUTE_ERP_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'APP_URL',
  'BASE_URL',
  'SITE_URL',
  'NEXTAUTH_URL',
  'VERCEL_URL',
] as const;

type RuntimeEnvValidationOptions = {
  requireServiceRole?: boolean;
};

type RuntimeEnvSnapshot = {
  canonicalAppUrl: string;
  serviceRoleKey: string | null;
  supabaseAnonKey: string;
  supabaseUrl: string;
};

const validatedSnapshots = new Map<string, RuntimeEnvSnapshot>();

function readRequiredEnvVar(name: string) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function resolveCanonicalAppUrl() {
  for (const key of CANONICAL_APP_URL_ENV_KEYS) {
    const value = String(process.env[key] ?? '').trim();
    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing required canonical app URL environment variable. Set one of: ${CANONICAL_APP_URL_ENV_KEYS.join(', ')}`,
  );
}

export function assertServerRuntimeEnv(options: RuntimeEnvValidationOptions = {}) {
  const cacheKey = options.requireServiceRole ? 'with-service-role' : 'without-service-role';
  const cached = validatedSnapshots.get(cacheKey);
  if (cached) {
    return cached;
  }

  const snapshot: RuntimeEnvSnapshot = {
    canonicalAppUrl: resolveCanonicalAppUrl(),
    serviceRoleKey: options.requireServiceRole
      ? readRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY')
      : String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() || null,
    supabaseAnonKey: readRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseUrl: readRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  };

  validatedSnapshots.set(cacheKey, snapshot);
  return snapshot;
}

export { CANONICAL_APP_URL_ENV_KEYS };
