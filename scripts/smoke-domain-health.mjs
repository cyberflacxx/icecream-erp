const BASE_URL = process.env.ABSOLUTE_ERP_BASE_URL?.trim().replace(/\/+$/, '') || 'https://www.absolute-erp.com';
const REQUEST_TIMEOUT_MS = Number(process.env.DOMAIN_SMOKE_TIMEOUT_MS || 15000);

const checks = [
  {
    label: 'Home route',
    path: '/',
    validate: async (response) => {
      const location = response.headers.get('location') || '';
      if (response.status === 200) return null;
      if (response.status >= 300 && response.status < 400 && /^\/(login|auth\/login)/.test(location)) {
        return null;
      }
      return `expected 200 or redirect to /login, received ${response.status}${location ? ` (${location})` : ''}`;
    },
  },
  {
    label: 'Login route',
    path: '/login',
    validate: async (response) => {
      if (response.status !== 200) {
        return `expected 200, received ${response.status}`;
      }
      return null;
    },
  },
  {
    label: 'API health',
    path: '/api/health',
    validate: async (response) => {
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== 'object') {
        return 'expected JSON payload';
      }
      if (payload.app !== 'absolute-ice-cream-erp') {
        return `unexpected app value: ${String(payload.app)}`;
      }
      return null;
    },
  },
  {
    label: 'Live check',
    path: '/api/health/live',
    validate: async (response) => {
      const payload = await response.json().catch(() => null);
      if (response.status !== 200 || payload?.status !== 'ok') {
        return `expected 200 with status ok, received ${response.status}`;
      }
      return null;
    },
  },
  {
    label: 'Ready check',
    path: '/api/health/ready',
    validate: async (response) => {
      const payload = await response.json().catch(() => null);
      if (response.status !== 200) {
        return `expected 200, received ${response.status}`;
      }
      if (payload?.checks?.database !== 'ok') {
        return `database status is ${String(payload?.checks?.database ?? 'unknown')}`;
      }
      return null;
    },
  },
];

async function runCheck({ label, path, validate }) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: path === '/' ? 'manual' : 'follow',
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'absolute-erp-domain-smoke/1.0',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${label}: request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

  const failure = await validate(response);
  if (failure) {
    throw new Error(`${label}: ${failure}`);
  }

  console.log(`[PASS] ${label}`);
}

async function main() {
  for (const check of checks) {
    await runCheck(check);
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
