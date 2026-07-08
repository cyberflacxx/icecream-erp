import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = path.join(ROOT, 'verification-results');
const DEFAULT_BASE_URL = 'https://www.absolute-erp.com';
const DEFAULT_TIMEOUT_MS = Number(process.env.FRONTEND_SMOKE_TIMEOUT_MS || 30000);

const DEFAULT_ACCOUNTS = {
  accountant: {
    role: 'Accountant',
    workId: process.env.ABSOLUTE_TEST_ACCOUNTANT_WORK_ID || 'AQI-20261008',
  },
  branchManager: {
    role: 'Branch Manager',
    workId: process.env.ABSOLUTE_TEST_BRANCH_MANAGER_WORK_ID || 'AQI-20261007',
  },
  superAdmin: {
    role: 'Super Admin',
    workId: process.env.ABSOLUTE_TEST_SUPER_ADMIN_WORK_ID || 'AQI-20261001',
  },
};

const FAILURE_PATTERNS = [
  'internal server error',
  'alert dashboard unavailable',
  'dashboard unavailable',
  'delivery logs unavailable',
  'notification settings unavailable',
  'failed to load',
  'application error',
  'page could not be found',
  'not found',
];

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

async function loadLocalEnv() {
  const merged = {};
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(ROOT, name);
    try {
      Object.assign(merged, parseEnvFile(await fs.readFile(envPath, 'utf8')));
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }
  return merged;
}

export async function getSmokeConfig() {
  const localEnv = await loadLocalEnv();
  return {
    accounts: DEFAULT_ACCOUNTS,
    baseUrl:
      process.env.ABSOLUTE_ERP_BASE_URL ||
      process.env.SMOKE_BASE_URL ||
      localEnv.ABSOLUTE_ERP_BASE_URL ||
      DEFAULT_BASE_URL,
    password:
      process.env.ABSOLUTE_TEST_PASSWORD ||
      process.env.DEMO_PASSWORD ||
      localEnv.ABSOLUTE_TEST_PASSWORD ||
      'Absolute@2026!',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export function parseCliArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [rawKey, rawValue] = token.slice(2).split('=');
    args[rawKey] = rawValue ?? true;
  }
  return args;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function login(baseUrl, workId, password, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await fetchWithTimeout(
    `${baseUrl}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workId, password }),
      redirect: 'manual',
    },
    timeoutMs,
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login failed for ${workId}: ${response.status} ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Login for ${workId} did not return a session cookie.`);
  }

  return setCookie.split(';')[0];
}

export async function requestPath(baseUrl, pathname, { cookie, method = 'GET', body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const response = await fetchWithTimeout(
    `${baseUrl}${pathname}`,
    {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    },
    timeoutMs,
  );

  const text = await response.text();
  return {
    location: response.headers.get('location'),
    status: response.status,
    text,
  };
}

function extractVisibleText(text) {
  return String(text ?? '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectFailure(pathname, status, text) {
  const normalized = ` ${extractVisibleText(text).toLowerCase()} `;
  const matched = FAILURE_PATTERNS.find((pattern) => normalized.includes(pattern));
  if (status !== 200) {
    return `unexpected status ${status}${pathname === '/' ? '' : ` on ${pathname}`}`;
  }
  if (matched) {
    return `matched "${matched.trim()}"`;
  }
  return null;
}

export function extractTitle(text) {
  const titleMatch = String(text ?? '').match(/<title>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
}

export async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  return OUTPUT_DIR;
}

export async function writeSmokeReport(baseName, payload) {
  const outputDir = await ensureOutputDir();
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const mdPath = path.join(outputDir, `${baseName}.md`);
  const failures = payload.results.filter((result) => result.failure);

  const markdown = [
    `# ${payload.title}`,
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Base URL: ${payload.baseUrl}`,
    `- Total checks: ${payload.results.length}`,
    `- Failures: ${failures.length}`,
    '',
    '| Check | Status | Role | Title | Failure |',
    '| --- | --- | --- | --- | --- |',
    ...payload.results.map((result) => {
      const title = (result.title || '').replace(/\|/g, '\\|');
      const failure = (result.failure || '').replace(/\|/g, '\\|');
      return `| ${result.label} | ${result.status} | ${result.role || 'public'} | ${title} | ${failure} |`;
    }),
  ].join('\n');

  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, `${markdown}\n`, 'utf8');

  return { jsonPath, mdPath, failures };
}

export async function runChecks({ baseUrl, checks, cookies, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const results = [];
  for (const check of checks) {
    const cookie = check.roleKey ? cookies[check.roleKey] : null;
    const response = await requestPath(baseUrl, check.path, { cookie, timeoutMs });
    results.push({
      failure: detectFailure(check.path, response.status, response.text),
      label: check.label || `${check.roleKey || 'public'} ${check.path}`,
      path: check.path,
      role: check.roleKey || 'public',
      status: response.status,
      title: extractTitle(response.text),
    });
  }
  return results;
}

export function summarizeResults(results) {
  const failures = results.filter((result) => result.failure);
  return {
    failureCount: failures.length,
    failures,
    total: results.length,
  };
}
