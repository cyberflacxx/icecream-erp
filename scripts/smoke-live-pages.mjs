import {
  getSmokeConfig,
  login,
  runChecks,
  summarizeResults,
  writeSmokeReport,
} from './_frontend-smoke-shared.mjs';

const PAGE_CHECKS = [
  { path: '/', roleKey: null },
  { path: '/dashboard', roleKey: 'superAdmin' },
  { path: '/procurement/dashboard', roleKey: 'superAdmin' },
  { path: '/procurement/requisitions', roleKey: 'superAdmin' },
  { path: '/procurement/purchase-orders', roleKey: 'superAdmin' },
  { path: '/inventory/dashboard', roleKey: 'superAdmin' },
  { path: '/inventory/stores', roleKey: 'superAdmin' },
  { path: '/inventory/reports', roleKey: 'superAdmin' },
  { path: '/production/dashboard', roleKey: 'superAdmin' },
  { path: '/production/transfers', roleKey: 'superAdmin' },
  { path: '/production/reports', roleKey: 'superAdmin' },
  { path: '/sales/dashboard', roleKey: 'superAdmin' },
  { path: '/sales/customers', roleKey: 'superAdmin' },
  { path: '/sales/orders', roleKey: 'superAdmin' },
  { path: '/sales/invoices', roleKey: 'superAdmin' },
  { path: '/finance/dashboard', roleKey: 'superAdmin' },
  { path: '/finance/petty-cash', roleKey: 'accountant' },
  { path: '/hr', roleKey: 'superAdmin' },
  { path: '/hr/employees', roleKey: 'superAdmin' },
  { path: '/maintenance', roleKey: 'superAdmin' },
  { path: '/maintenance/machines', roleKey: 'superAdmin' },
  { path: '/maintenance/breakdowns', roleKey: 'superAdmin' },
  { path: '/maintenance/schedules', roleKey: 'superAdmin' },
  { path: '/notifications', roleKey: 'branchManager' },
  { path: '/notifications/dashboard', roleKey: 'branchManager' },
  { path: '/notifications/settings', roleKey: 'branchManager' },
  { path: '/notifications/delivery-logs', roleKey: 'branchManager' },
  { path: '/reports', roleKey: 'superAdmin' },
  { path: '/reports/history', roleKey: 'superAdmin' },
  { path: '/settings/audit-logs', roleKey: 'superAdmin' },
  { path: '/settings/users', roleKey: 'superAdmin' },
];

async function main() {
  const config = await getSmokeConfig();
  const cookies = {
    accountant: await login(config.baseUrl, config.accounts.accountant.workId, config.password, config.timeoutMs),
    branchManager: await login(config.baseUrl, config.accounts.branchManager.workId, config.password, config.timeoutMs),
    superAdmin: await login(config.baseUrl, config.accounts.superAdmin.workId, config.password, config.timeoutMs),
  };

  const results = await runChecks({
    baseUrl: config.baseUrl,
    checks: PAGE_CHECKS,
    cookies,
    timeoutMs: config.timeoutMs,
  });
  const summary = summarizeResults(results);
  const report = await writeSmokeReport('live-page-smoke', {
    baseUrl: config.baseUrl,
    results,
    summary,
    title: 'Live Page Smoke',
  });

  console.log(
    JSON.stringify(
      {
        baseUrl: config.baseUrl,
        failureCount: summary.failureCount,
        markdownReport: report.mdPath,
        jsonReport: report.jsonPath,
        total: summary.total,
      },
      null,
      2,
    ),
  );

  if (summary.failureCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
