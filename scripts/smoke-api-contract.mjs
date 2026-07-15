import { getSmokeConfig, login, requestPath } from './_frontend-smoke-shared.mjs';

const CHECKS = [
  { path: '/api/dashboard', roleKey: 'superAdmin' },
  { path: '/api/sales/dashboard', roleKey: 'superAdmin' },
  { path: '/api/sales/quotations', roleKey: 'superAdmin' },
  { path: '/api/sales/orders', roleKey: 'superAdmin' },
  { path: '/api/sales/invoices', roleKey: 'superAdmin' },
  { path: '/api/sales/payments', roleKey: 'superAdmin' },
  { path: '/api/sales/customers', roleKey: 'superAdmin' },
  { path: '/api/sales/dispatches', roleKey: 'superAdmin' },
  { path: '/api/sales/prices', roleKey: 'superAdmin' },
  { path: '/api/sales/returns', roleKey: 'superAdmin' },
  { path: '/api/notifications', roleKey: 'branchManager' },
  { path: '/api/notifications/alert-dashboard', roleKey: 'branchManager' },
  { path: '/api/notifications/settings', roleKey: 'branchManager' },
  { path: '/api/notifications/delivery-logs', roleKey: 'branchManager' },
  { path: '/api/finance/dashboard', roleKey: 'superAdmin' },
  { path: '/api/hr/dashboard', roleKey: 'superAdmin' },
  { path: '/api/production/dashboard', roleKey: 'superAdmin' },
  { path: '/api/inventory/dashboard', roleKey: 'superAdmin' },
];

async function main() {
  const config = await getSmokeConfig();
  const cookies = {
    branchManager: await login(config.baseUrl, config.accounts.branchManager.workId, config.password, config.timeoutMs),
    superAdmin: await login(config.baseUrl, config.accounts.superAdmin.workId, config.password, config.timeoutMs),
  };

  const results = [];

  for (const check of CHECKS) {
    const cookie = cookies[check.roleKey];
    const response = await requestPath(config.baseUrl, check.path, { cookie, timeoutMs: config.timeoutMs });
    const acceptable = [200, 401, 403].includes(response.status);
    results.push({
      acceptable,
      path: check.path,
      role: check.roleKey,
      status: response.status,
    });
  }

  const failures = results.filter((result) => !result.acceptable);
  console.log(JSON.stringify({ baseUrl: config.baseUrl, failures, results, total: results.length }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
