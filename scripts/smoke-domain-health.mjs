const DEFAULT_BASE_URL = 'https://www.absolute-erp.com';
const BASE_URL = (
  process.env.DOMAIN_SMOKE_BASE_URL?.trim()
  || process.env.ABSOLUTE_ERP_BASE_URL?.trim()
  || DEFAULT_BASE_URL
).replace(/\/+$/, '');
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

function toPrintable(value) {
  if (value === undefined || value === null || value === '') {
    return 'n/a';
  }

  return String(value);
}

function getStackFirstLine(error) {
  if (!(error instanceof Error) || typeof error.stack !== 'string') {
    return 'n/a';
  }

  return error.stack.split('\n')[0]?.trim() || 'n/a';
}

function getCauseDetails(error) {
  const cause = error instanceof Error ? error.cause : undefined;
  if (!cause || typeof cause !== 'object') {
    return {
      code: 'n/a',
      message: 'n/a',
    };
  }

  return {
    code: toPrintable('code' in cause ? cause.code : undefined),
    message: toPrintable('message' in cause ? cause.message : undefined),
  };
}

function formatRedirectUrl(response, requestUrl) {
  const location = response.headers.get('location');
  if (location) {
    try {
      return new URL(location, requestUrl).toString();
    } catch {
      return location;
    }
  }

  if (response.redirected && response.url && response.url !== requestUrl) {
    return response.url;
  }

  return 'n/a';
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error(`request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      timeoutError.name = 'AbortError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function runCheck({ label, path, validate }) {
  const requestUrl = `${BASE_URL}${path}`;
  const result = {
    label,
    path,
    requestUrl,
    ok: false,
    status: 'n/a',
    contentType: 'n/a',
    finalUrl: requestUrl,
    redirectUrl: 'n/a',
    failure: null,
    fetchError: null,
  };

  console.log(`[CHECK] ${label}`);
  console.log(`route: ${path}`);
  console.log(`url: ${requestUrl}`);

  try {
    const response = await fetchWithTimeout(requestUrl, {
      method: 'GET',
      redirect: path === '/' ? 'manual' : 'follow',
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'absolute-erp-domain-smoke/1.0',
      },
    });

    result.status = String(response.status);
    result.contentType = response.headers.get('content-type') || 'n/a';
    result.finalUrl = response.url || requestUrl;
    result.redirectUrl = formatRedirectUrl(response, requestUrl);

    console.log(`final URL: ${result.finalUrl}`);
    console.log(`status: ${result.status}`);
    console.log(`content-type: ${result.contentType}`);
    console.log(`redirect URL: ${result.redirectUrl}`);

    const failure = await validate(response);
    if (failure) {
      result.failure = failure;
      console.log(`[FAIL] ${label}: ${failure}`);
      return result;
    }

    result.ok = true;
    console.log(`[PASS] ${label}`);
    return result;
  } catch (error) {
    const cause = getCauseDetails(error);
    result.fetchError = {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      causeCode: cause.code,
      causeMessage: cause.message,
      stackFirstLine: getStackFirstLine(error),
    };

    console.log('final URL: n/a');
    console.log('status: n/a');
    console.log('content-type: n/a');
    console.log('redirect URL: n/a');
    console.log(`[FAIL] ${label}: fetch failed before HTTP response`);
    console.log(`error name: ${result.fetchError.name}`);
    console.log(`error message: ${result.fetchError.message}`);
    console.log(`cause code: ${result.fetchError.causeCode}`);
    console.log(`cause message: ${result.fetchError.causeMessage}`);
    console.log(`stack first line: ${result.fetchError.stackFirstLine}`);

    return result;
  }
}

function printSummary(results) {
  const passed = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  const rootResult = results.find((result) => result.path === '/');
  const apiHealthResult = results.find((result) => result.path === '/api/health');

  console.log('');
  console.log('[SUMMARY]');
  console.log(`base URL: ${BASE_URL}`);
  console.log(`passed: ${passed.length}`);
  console.log(`failed: ${failed.length}`);

  for (const result of results) {
    console.log(
      `${result.ok ? '[PASS]' : '[FAIL]'} ${result.path} -> final URL: ${result.finalUrl}, status: ${result.status}, content-type: ${result.contentType}, redirect URL: ${result.redirectUrl}`,
    );
  }

  if (rootResult?.ok && apiHealthResult && !apiHealthResult.ok) {
    console.log('Root route loads, but /api/health fails.');
  }
}

async function main() {
  console.log(`Domain smoke base URL: ${BASE_URL}`);
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms`);

  const results = [];
  for (const check of checks) {
    results.push(await runCheck(check));
    console.log('');
  }

  printSummary(results);

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const cause = getCauseDetails(error);
  console.error('[FAIL] Domain smoke crashed');
  console.error(`error name: ${error instanceof Error ? error.name : typeof error}`);
  console.error(`error message: ${error instanceof Error ? error.message : String(error)}`);
  console.error(`cause code: ${cause.code}`);
  console.error(`cause message: ${cause.message}`);
  console.error(`stack first line: ${getStackFirstLine(error)}`);
  process.exitCode = 1;
});
