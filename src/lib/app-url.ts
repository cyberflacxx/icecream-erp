const PUBLIC_APP_URL_FALLBACK = 'https://www.absolute-erp.com';

const APP_URL_ENV_KEYS = [
  'ABSOLUTE_ERP_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'APP_URL',
  'BASE_URL',
  'SITE_URL',
  'NEXTAUTH_URL',
  'VERCEL_URL',
] as const;

function normalizeBaseUrl(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return `https://${trimmed}`.replace(/\/+$/, '');
  }

  return null;
}

function getConfiguredBaseUrl() {
  for (const key of APP_URL_ENV_KEYS) {
    const normalized = normalizeBaseUrl(process.env[key]);
    if (normalized) return normalized;
  }

  return null;
}

function getRequestOrigin(request?: Request | URL | null) {
  if (!request) return null;

  const url = request instanceof URL ? request : new URL(request.url);
  const origin = normalizeBaseUrl(url.origin);
  if (!origin) return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return origin;
  }

  return null;
}

export function resolvePublicAppUrl(request?: Request | URL | null) {
  return getConfiguredBaseUrl() ?? getRequestOrigin(request) ?? PUBLIC_APP_URL_FALLBACK;
}

export function toAbsoluteAppUrl(path: string, request?: Request | URL | null) {
  return new URL(path, `${resolvePublicAppUrl(request)}/`).toString();
}

export { APP_URL_ENV_KEYS, PUBLIC_APP_URL_FALLBACK };
