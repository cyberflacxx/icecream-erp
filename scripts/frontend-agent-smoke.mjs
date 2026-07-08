import {
  detectFailure,
  extractTitle,
  getSmokeConfig,
  login,
  parseCliArgs,
  requestPath,
  writeSmokeReport,
} from './_frontend-smoke-shared.mjs';

const PAGE_MODE_CHECKS = [
  { path: '/dashboard', roleKey: 'superAdmin' },
  { path: '/procurement/requisitions', roleKey: 'superAdmin' },
  { path: '/inventory/stores', roleKey: 'superAdmin' },
  { path: '/production/reports', roleKey: 'superAdmin' },
  { path: '/sales/customers', roleKey: 'superAdmin' },
  { path: '/finance/petty-cash', roleKey: 'accountant' },
  { path: '/hr/employees', roleKey: 'superAdmin' },
  { path: '/maintenance/machines', roleKey: 'superAdmin' },
  { path: '/notifications/dashboard', roleKey: 'branchManager' },
  { path: '/notifications/settings', roleKey: 'branchManager' },
  { path: '/notifications/delivery-logs', roleKey: 'branchManager' },
  { path: '/reports/history', roleKey: 'superAdmin' },
  { path: '/settings/users', roleKey: 'superAdmin' },
];

const FORM_MODE_CHECKS = [
  { path: '/procurement/requisitions', roleKey: 'superAdmin' },
  { path: '/procurement/purchase-orders', roleKey: 'superAdmin' },
  { path: '/inventory/stores', roleKey: 'superAdmin' },
  { path: '/sales/customers', roleKey: 'superAdmin' },
  { path: '/sales/orders', roleKey: 'superAdmin' },
  { path: '/sales/invoices', roleKey: 'superAdmin' },
  { path: '/finance/petty-cash', roleKey: 'accountant' },
  { path: '/hr/employees', roleKey: 'superAdmin' },
  { path: '/maintenance/machines', roleKey: 'superAdmin' },
  { path: '/maintenance/breakdowns', roleKey: 'superAdmin' },
  { path: '/notifications/settings', roleKey: 'branchManager' },
  { path: '/settings/users', roleKey: 'superAdmin' },
];

async function runAgentChecks({ baseUrl, checks, cookies, timeoutMs }) {
  const results = [];
  let failureCount = 0;

  for (const check of checks) {
    const cookie = check.roleKey ? cookies[check.roleKey] : null;
    const response = await requestPath(baseUrl, check.path, { cookie, timeoutMs });
    const failure = detectFailure(check.path, response.status, response.text);
    results.push({
      failure,
      label: `${check.roleKey || 'public'} ${check.path}`,
      path: check.path,
      role: check.roleKey || 'public',
      status: response.status,
      title: extractTitle(response.text),
    });

    if (failure) {
      failureCount += 1;
      if (failureCount >= 20) {
        results.push({
          failure: null,
          label: 'agent-stop',
          path: '',
          role: 'system',
          status: 0,
          title: 'Stopped after 20 failures',
        });
        break;
      }
    }
  }

  return results;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const mode = String(args.mode || 'pages');
  const allowWrite = args['allow-write'] === true;

  if (!['pages', 'forms-open', 'forms-write'].includes(mode)) {
    throw new Error(`Unsupported mode "${mode}". Use --mode=pages, --mode=forms-open, or --mode=forms-write.`);
  }
  if (mode === 'forms-write' && !allowWrite) {
    throw new Error('forms-write mode requires --allow-write.');
  }

  const config = await getSmokeConfig();
  const cookies = {
    accountant: await login(config.baseUrl, config.accounts.accountant.workId, config.password, config.timeoutMs),
    branchManager: await login(config.baseUrl, config.accounts.branchManager.workId, config.password, config.timeoutMs),
    superAdmin: await login(config.baseUrl, config.accounts.superAdmin.workId, config.password, config.timeoutMs),
  };

  const checks =
    mode === 'pages'
      ? PAGE_MODE_CHECKS
      : FORM_MODE_CHECKS;

  const results = await runAgentChecks({
    baseUrl: config.baseUrl,
    checks,
    cookies,
    timeoutMs: config.timeoutMs,
  });

  const failureCount = results.filter((result) => result.failure).length;
  const report = await writeSmokeReport('frontend-agent-smoke', {
    baseUrl: config.baseUrl,
    mode,
    note:
      mode === 'forms-write'
        ? 'Fetch-only stabilization mode was used. Live record creation remains intentionally disabled in this script.'
        : 'Fetch-only stabilization mode validated route availability and crash markers.',
    results,
    summary: {
      failureCount,
      total: results.length,
    },
    title: 'Frontend Agent Smoke',
  });

  console.log(
    JSON.stringify(
      {
        baseUrl: config.baseUrl,
        failureCount,
        markdownReport: report.mdPath,
        mode,
        total: results.length,
      },
      null,
      2,
    ),
  );

  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
