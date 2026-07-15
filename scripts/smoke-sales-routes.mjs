import { getSmokeConfig, login, requestPath } from './_frontend-smoke-shared.mjs';

const PAGE_CHECKS = [
  '/sales/dashboard',
  '/sales/customers',
  '/sales/prices',
  '/sales/discounts',
  '/sales/quotations',
  '/sales/orders',
  '/sales/invoices',
  '/sales/dispatches',
  '/sales/payments',
  '/sales/returns',
];

const API_CHECKS = [
  '/api/sales/dashboard',
  '/api/sales/customers',
  '/api/sales/prices',
  '/api/sales/discounts',
  '/api/sales/quotations',
  '/api/sales/orders',
  '/api/sales/invoices',
  '/api/sales/dispatches',
  '/api/sales/payments',
  '/api/sales/returns',
  '/api/sales/meta',
];

const FAILURE_PATTERNS = [
  'internal server error',
  'schema cache',
  'table not found',
  'column not found',
  'could not find the table',
  'could not find a relationship',
  'pgrst205',
  'pgrst106',
  'module unavailable',
];

function hasFailureText(text) {
  const normalized = String(text ?? '').toLowerCase();
  return FAILURE_PATTERNS.find((pattern) => normalized.includes(pattern)) ?? null;
}

async function main() {
  const config = await getSmokeConfig();
  const cookie = await login(
    config.baseUrl,
    config.accounts.superAdmin.workId,
    config.password,
    config.timeoutMs,
  );

  const checks = [
    ...PAGE_CHECKS.map((path) => ({ kind: 'page', path })),
    ...API_CHECKS.map((path) => ({ kind: 'api', path })),
  ];

  const results = [];
  for (const check of checks) {
    const response = await requestPath(config.baseUrl, check.path, {
      cookie,
      timeoutMs: config.timeoutMs,
    });
    const failureText = hasFailureText(response.text);
    const acceptableStatus = [200, 401, 403].includes(response.status);
    results.push({
      acceptable: acceptableStatus && !failureText,
      failure: failureText,
      kind: check.kind,
      path: check.path,
      status: response.status,
    });
  }

  const failures = results.filter((result) => !result.acceptable);
  console.log(
    JSON.stringify(
      {
        baseUrl: config.baseUrl,
        failures,
        results,
        total: results.length,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
