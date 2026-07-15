import {
  getSmokeConfig,
  login,
  runChecks,
  summarizeResults,
  writeSmokeReport,
} from './_frontend-smoke-shared.mjs';

const DASHBOARD_CHECKS = [
  { path: '/dashboard', roleKey: 'superAdmin' },
  { path: '/sales/dashboard', roleKey: 'superAdmin' },
  { path: '/procurement/dashboard', roleKey: 'superAdmin' },
  { path: '/inventory/dashboard', roleKey: 'superAdmin' },
  { path: '/production/dashboard', roleKey: 'superAdmin' },
  { path: '/finance/dashboard', roleKey: 'superAdmin' },
  { path: '/notifications/dashboard', roleKey: 'branchManager' },
];

async function main() {
  const config = await getSmokeConfig();
  const cookies = {
    branchManager: await login(config.baseUrl, config.accounts.branchManager.workId, config.password, config.timeoutMs),
    superAdmin: await login(config.baseUrl, config.accounts.superAdmin.workId, config.password, config.timeoutMs),
  };

  const results = await runChecks({
    baseUrl: config.baseUrl,
    checks: DASHBOARD_CHECKS,
    cookies,
    timeoutMs: config.timeoutMs,
  });
  const summary = summarizeResults(results);
  const report = await writeSmokeReport('dashboard-page-smoke', {
    baseUrl: config.baseUrl,
    results,
    summary,
    title: 'Dashboard Page Smoke',
  });

  console.log(
    JSON.stringify(
      {
        baseUrl: config.baseUrl,
        failureCount: summary.failureCount,
        jsonReport: report.jsonPath,
        markdownReport: report.mdPath,
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
