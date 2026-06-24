import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'src', 'app');
const ENV_PATH = path.join(ROOT, '.env');

function parseEnvFile(contents) {
  const env = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    env[key] = value;
  }
  return env;
}

function routeFromPageFile(filePath) {
  const rel = path.relative(APP_DIR, filePath).replace(/\\/g, '/');
  if (/^page\.(tsx|ts)$/.test(rel)) {
    return '/';
  }
  const withoutPage = rel.replace(/\/page\.(tsx|ts)$/, '');
  if (withoutPage.startsWith('api/')) return null;

  const segments = withoutPage
    .split('/')
    .filter(Boolean)
    .filter((segment) => !segment.startsWith('(') && !segment.endsWith(')'))
    .filter((segment) => !segment.startsWith('@'));

  if (segments.some((segment) => segment.includes('[[...') || segment.includes('[...'))) {
    return null;
  }

  return `/${segments.join('/')}`.replace(/\/+/g, '/');
}

async function listPageFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPageFiles(fullPath)));
      continue;
    }

    if (/page\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function createServiceHeaders() {
  const env = parseEnvFile(await fs.readFile(ENV_PATH, 'utf8'));
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseSelect(service, table, select = 'id', extra = '') {
  const query = `select=${encodeURIComponent(select)}&limit=1${extra ? `&${extra}` : ''}`;
  const response = await fetch(`${service.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: service.key,
      authorization: `Bearer ${service.key}`,
      'accept-profile': 'icecream_erp',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase query failed for ${table}: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0] ?? null;
}

async function getSampleIds() {
  const service = await createServiceHeaders();

  const [branch, purchaseOrder, supplier] = await Promise.all([
    supabaseSelect(service, 'branches', 'id', 'order=name.asc'),
    supabaseSelect(service, 'purchase_orders', 'id', 'order=created_at.asc'),
    supabaseSelect(service, 'suppliers', 'id', 'order=created_at.asc'),
  ]);

  return {
    branchId: branch?.id ?? null,
    purchaseOrderId: purchaseOrder?.id ?? null,
    supplierId: supplier?.id ?? null,
  };
}

function expandDynamicRoute(route, samples) {
  if (!route.includes('[')) {
    return [route];
  }

  if (route.includes('/branches/[id]')) {
    return samples.branchId ? [route.replaceAll('[id]', samples.branchId)] : [];
  }

  if (route.includes('/procurement/purchase-orders/[id]')) {
    return samples.purchaseOrderId ? [route.replace('[id]', samples.purchaseOrderId)] : [];
  }

  if (route.includes('/procurement/suppliers/[id]')) {
    return samples.supplierId ? [route.replace('[id]', samples.supplierId)] : [];
  }

  return [];
}

async function login(baseUrl, workId, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workId, password }),
    redirect: 'manual',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed for ${workId}: ${response.status} ${body}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`No session cookie returned for ${workId}`);
  }

  return setCookie.split(';')[0];
}

async function probe(baseUrl, route, cookie) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });

  return {
    route,
    status: response.status,
    location: response.headers.get('location'),
  };
}

function summarize(label, results) {
  const failures = results.filter((result) => result.status >= 400);
  return {
    label,
    total: results.length,
    failures,
  };
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
  const pageFiles = await listPageFiles(APP_DIR);
  const routes = Array.from(
    new Set(
      pageFiles
        .map(routeFromPageFile)
        .filter(Boolean),
    ),
  ).sort();

  const samples = await getSampleIds();
  const expandedRoutes = Array.from(
    new Set(
      routes.flatMap((route) => expandDynamicRoute(route, samples)).concat(
        routes.filter((route) => !route.includes('[')),
      ),
    ),
  ).sort();

  const publicRoutes = expandedRoutes.filter((route) => route === '/' || route.startsWith('/auth'));
  const protectedRoutes = expandedRoutes.filter((route) => !publicRoutes.includes(route));

  const adminCookie = await login(baseUrl, 'AQI-20260004', process.env.DEMO_PASSWORD || 'Demo@2026!');
  const branchCookie = await login(baseUrl, 'AQI-20260005', process.env.DEMO_PASSWORD || 'Demo@2026!');

  const publicResults = await Promise.all(publicRoutes.map((route) => probe(baseUrl, route, null)));
  const adminResults = await Promise.all(protectedRoutes.map((route) => probe(baseUrl, route, adminCookie)));
  const branchResults = await Promise.all(
    [
      '/dashboard',
      '/branches',
      samples.branchId ? `/branches/${samples.branchId}` : null,
      '/sales',
      '/inventory',
      '/finance',
      '/settings',
      '/workflows',
      '/testing',
    ]
      .filter(Boolean)
      .map((route) => probe(baseUrl, route, branchCookie)),
  );

  const summary = {
    public: summarize('public', publicResults),
    admin: summarize('admin', adminResults),
    branch: summarize('branch', branchResults),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (
    summary.public.failures.length > 0 ||
    summary.admin.failures.length > 0 ||
    summary.branch.failures.some((result) => ![200, 302, 307, 308, 403].includes(result.status))
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
