import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NextResponse } from 'next/server';

import {
  buildProductionOrdersDashboard,
  buildProductionSmokeSetupFailure,
  buildProductionStockReceiveFailure,
  buildProductionStockReceiveSignature,
  buildCostingRows,
  buildProductivityRows,
  buildShiftPerformanceRows,
  buildVarianceRows,
  buildYieldRows,
  calculateScaledMaterialRequirement,
  calculateScalingFactor,
  calculateRequiredMaterials,
  calculateCostPerUnit,
  calculateProductionSmokeSeedQuantity,
  calculateProductivity,
  calculateYieldPercentage,
  getExistingWarehouseTypes,
  isProductionDocumentDateInFuture,
  normalizeProductionStockReceiveItems,
  resolveWarehouseTypeCandidatesForLive,
  resolveWarehouseTypeForLive,
  selectLatestActiveBom,
  validateRecipeImportRows,
  validateShiftTargetImportRows,
} from '../src/lib/production';
import {
  PRODUCTION_BRANCH_NOT_AVAILABLE,
  PRODUCTION_ORDER_NOT_FOUND,
  authorizeProductionOrderForWrite,
  resolveProductionCreateBranchAuthorization,
  resolveProductionUpdateBranchAuthorization,
  type ProductionAuthorizationContext,
  type ProductionBranchAuthorizationRecord,
  type ProductionOrderAuthorizationRecord,
} from '../src/lib/production-order-authorization';

type JsonResponseFactory = (message?: string) => Response;

function loadRouteModule<T>(modulePath: string, mocks: Record<string, unknown>): T {
  const typescript = require('typescript') as typeof import('typescript');
  const nodeRequire = require;
  const source = fs.readFileSync(modulePath, 'utf8');
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
    },
    fileName: modulePath,
  });

  const module = { exports: {} as T };
  const commonMocks: Record<string, unknown> = {
    '@/lib/finance-foundation-server': {
      async findOpenFiscalPeriod() {
        return { id: 'period-1' };
      },
      getFinanceModuleDefaultCostCentreCodes() {
        return ['FACTORY'];
      },
      async resolveFinanceCostCentreCode() {
        return 'FACTORY';
      },
      async resolveFinancePostingAccount() {
        return { id: 'acct-1' };
      },
    },
    '@/lib/finance-integration': {
      collapseFinancePostingLines(lines: unknown[]) {
        return lines;
      },
      resolveInventoryPostingMappingKey() {
        return 'RAW_MATERIAL_INVENTORY';
      },
      resolveProductionCostCentrePriority() {
        return ['FACTORY'];
      },
      toDateOnly(value: string) {
        return value;
      },
    },
    '@/lib/finance-server': {
      async deleteFinanceJournalById() {
        return null;
      },
      async findJournalBySource() {
        return null;
      },
      async loadLedgerLines() {
        return [];
      },
      async postFinanceDocument() {
        return { entryNumber: 'JE-00001', id: 'journal-1' };
      },
    },
    '@/lib/supabase/server': {
      createServiceRoleClient() {
        return {
          schema() {
            return this;
          },
          from() {
            return {
              eq() {
                return this;
              },
              in() {
                return this;
              },
              select() {
                return this;
              },
              single: async () => ({ data: null, error: null }),
            };
          },
        };
      },
    },
  };
  const scopedRequire = (request: string) => {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    if (Object.prototype.hasOwnProperty.call(commonMocks, request)) {
      return commonMocks[request];
    }

    return nodeRequire(request);
  };

  const evaluator = new Function('require', 'module', 'exports', compiled.outputText);
  evaluator(scopedRequire, module, module.exports);
  return module.exports;
}

function createMockJsonRequest(body: unknown, options?: {
  headers?: Record<string, string>;
  url?: string;
}) {
  const headers = new Map(
    Object.entries(options?.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    json: async () => body,
    url: options?.url ?? 'http://localhost/api/production/orders',
  };
}

function createResponseFactory(status: number): JsonResponseFactory {
  return (message = status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Error') =>
    NextResponse.json({ error: message }, { status });
}

function createApiAuthMock(ctx: unknown, permissionsGranted = true) {
  return {
    badRequest: (message: string) => NextResponse.json({ error: message }, { status: 400 }),
    can: () => permissionsGranted,
    forbidden: createResponseFactory(403),
    getAuthContext: async () => ctx,
    notFound: (message = 'Not found') => NextResponse.json({ error: message }, { status: 404 }),
    serverError: (message = 'Internal server error') => NextResponse.json({ error: message }, { status: 500 }),
    unauthorized: createResponseFactory(401),
  };
}

function productionAuthContext(overrides: Partial<ProductionAuthorizationContext> = {}): ProductionAuthorizationContext {
  return {
    branchAssignments: ['branch-a'],
    branchId: 'branch-a',
    isBranchScoped: true,
    organizationId: 'org-1',
    permissions: ['production_order.create'],
    ...overrides,
  };
}

function productionOrderRecord(overrides: Partial<ProductionOrderAuthorizationRecord> = {}): ProductionOrderAuthorizationRecord {
  return {
    branchId: 'branch-a',
    id: 'order-1',
    isLocked: false,
    organizationId: 'org-1',
    status: 'PLANNED',
    ...overrides,
  };
}

function productionBranchRecord(overrides: Partial<ProductionBranchAuthorizationRecord> = {}): ProductionBranchAuthorizationRecord {
  return {
    id: 'branch-a',
    organizationId: 'org-1',
    status: 'ACTIVE',
    ...overrides,
  };
}

function readSqlFunctionParameters(sql: string, functionName: string) {
  const match = sql.match(new RegExp(`create or replace function icecream_erp\\.${functionName}\\s*\\(([^]*?)\\)\\s*returns`, 'i'));
  assert.ok(match, `SQL signature for ${functionName} was not found.`);

  return match[1]
    .split(/,\s*\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parameter = line.match(/^(p_[a-z0-9_]+)\s+/i)?.[1];
      assert.ok(parameter, `Parameter could not be parsed from SQL line: ${line}`);
      return parameter;
    });
}

function readWrapperRpcParameters(source: string, wrapperName: string, rpcName: string) {
  const match = source.match(new RegExp(`export async function ${wrapperName}\\([^]*?service\\.rpc\\('${rpcName}',\\s*\\{([^]*?)\\}\\);`, 'i'));
  assert.ok(match, `Wrapper payload for ${wrapperName} was not found.`);

  return [...match[1].matchAll(/\b(p_[a-z0-9_]+)\s*:/gi)].map((entry) => entry[1]);
}

test('production order migration package stays schema-local and additive', () => {
  const migrationNames = [
    '035_production_order_workflow_foundation.sql',
    '036_production_issue_and_receipt_documents.sql',
    '037_production_order_planning_release_rpcs.sql',
    '038_production_order_transaction_rpcs.sql',
    '039_production_relationship_map_and_reporting.sql',
    '042_production_reopen_and_relationship_links.sql',
  ];

  const migrations = migrationNames.map((name) => fs.readFileSync(`migrations/${name}`, 'utf8')).join('\n');

  assert.match(migrations, /create table if not exists icecream_erp\.production_orders/i);
  assert.match(migrations, /create table if not exists icecream_erp\.production_order_components/i);
  assert.match(migrations, /create table if not exists icecream_erp\.production_issues/i);
  assert.match(migrations, /create table if not exists icecream_erp\.production_receipts/i);
  assert.match(migrations, /create or replace function icecream_erp\.release_production_order/i);
  assert.match(migrations, /create or replace function icecream_erp\.post_production_issue/i);
  assert.match(migrations, /create or replace function icecream_erp\.post_production_receipt/i);
  assert.match(migrations, /create or replace function icecream_erp\.close_production_order/i);
  assert.match(migrations, /create or replace function icecream_erp\.reopen_production_order/i);
  assert.match(migrations, /for update/i);
  assert.match(migrations, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(migrations, /alter role\s+authenticator/i);
  assert.doesNotMatch(migrations, /^\s*drop\s+table/im);
  assert.doesNotMatch(migrations, /^\s*truncate\s+table/im);
  assert.doesNotMatch(migrations, /create table\s+public\./i);
});

test('production order routes delegate workflow changes to RPC-backed helpers', () => {
  const releaseRoute = fs.readFileSync('src/app/api/production/orders/[id]/release/route.ts', 'utf8');
  const issueRoute = fs.readFileSync('src/app/api/production/orders/[id]/issue/route.ts', 'utf8');
  const receiptRoute = fs.readFileSync('src/app/api/production/orders/[id]/receipt/route.ts', 'utf8');
  const closeRoute = fs.readFileSync('src/app/api/production/orders/[id]/close/route.ts', 'utf8');
  const reverseIssueRoute = fs.readFileSync('src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts', 'utf8');
  const reverseReceiptRoute = fs.readFileSync('src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts', 'utf8');
  const reopenRoute = fs.readFileSync('src/app/api/production/orders/[id]/reopen/route.ts', 'utf8');
  const helper = fs.readFileSync('src/lib/production-orders-server.ts', 'utf8');

  assert.match(releaseRoute, /releaseProductionOrder/);
  assert.match(issueRoute, /postProductionIssue/);
  assert.match(receiptRoute, /postProductionReceipt/);
  assert.match(closeRoute, /closeProductionOrder/);
  assert.match(reverseIssueRoute, /reverseProductionIssue/);
  assert.match(reverseReceiptRoute, /reverseProductionReceipt/);
  assert.match(reopenRoute, /reopenProductionOrder/);
  assert.match(helper, /\.rpc\('release_production_order'/);
  assert.match(helper, /\.rpc\('post_production_issue'/);
  assert.match(helper, /\.rpc\('post_production_receipt'/);
  assert.match(helper, /\.rpc\('close_production_order'/);
  assert.match(helper, /\.rpc\('reverse_production_issue'/);
  assert.match(helper, /\.rpc\('reverse_production_receipt'/);
  assert.match(helper, /\.rpc\('reopen_production_order'/);
});

test('production RPC wrappers preserve the exact SQL parameter coverage across all eight RPCs', () => {
  const planningSql = fs.readFileSync('migrations/037_production_order_planning_release_rpcs.sql', 'utf8');
  const transactionSql = fs.readFileSync('migrations/038_production_order_transaction_rpcs.sql', 'utf8');
  const reopenSql = fs.readFileSync('migrations/042_production_reopen_and_relationship_links.sql', 'utf8');
  const helper = fs.readFileSync('src/lib/production-orders-server.ts', 'utf8');

  const expectations = [
    { functionName: 'save_planned_production_order', rpcName: 'save_planned_production_order', sql: planningSql, wrapperName: 'savePlannedProductionOrder' },
    { functionName: 'release_production_order', rpcName: 'release_production_order', sql: planningSql, wrapperName: 'releaseProductionOrder' },
    { functionName: 'post_production_issue', rpcName: 'post_production_issue', sql: transactionSql, wrapperName: 'postProductionIssue' },
    { functionName: 'post_production_receipt', rpcName: 'post_production_receipt', sql: transactionSql, wrapperName: 'postProductionReceipt' },
    { functionName: 'close_production_order', rpcName: 'close_production_order', sql: transactionSql, wrapperName: 'closeProductionOrder' },
    { functionName: 'reverse_production_issue', rpcName: 'reverse_production_issue', sql: transactionSql, wrapperName: 'reverseProductionIssue' },
    { functionName: 'reverse_production_receipt', rpcName: 'reverse_production_receipt', sql: transactionSql, wrapperName: 'reverseProductionReceipt' },
    { functionName: 'reopen_production_order', rpcName: 'reopen_production_order', sql: reopenSql, wrapperName: 'reopenProductionOrder' },
  ];

  for (const expectation of expectations) {
    const wrapperParameters = readWrapperRpcParameters(helper, expectation.wrapperName, expectation.rpcName);
    const sqlParameters = readSqlFunctionParameters(expectation.sql, expectation.functionName);

    assert.equal(
      wrapperParameters.length,
      sqlParameters.length,
      `${expectation.wrapperName} does not expose the same parameter count as ${expectation.functionName}.`,
    );
    assert.deepEqual(
      [...wrapperParameters].sort(),
      [...sqlParameters].sort(),
      `${expectation.wrapperName} does not match the SQL parameter set for ${expectation.functionName}.`,
    );
  }
});

test('migration directory does not contain duplicate three-digit prefixes', () => {
  const files = fs.readdirSync('migrations')
    .filter((name) => /^\d{3}_.+\.sql$/i.test(name));

  const duplicates = new Map<string, string[]>();
  for (const file of files) {
    const prefix = file.slice(0, 3);
    const current = duplicates.get(prefix) ?? [];
    current.push(file);
    duplicates.set(prefix, current);
  }

  const collisions = [...duplicates.entries()].filter(([, names]) => names.length > 1);
  assert.deepEqual(collisions, []);
});

test('branch-scoped create authorization forces the authenticated branch', () => {
  const result = resolveProductionCreateBranchAuthorization(
    productionAuthContext(),
    'branch-b',
    null,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.branchId, 'branch-a');
  }
});

test('head-office create authorization accepts a valid same-organization branch', () => {
  const result = resolveProductionCreateBranchAuthorization(
    productionAuthContext({
      branchAssignments: [],
      branchId: null,
      isBranchScoped: false,
      permissions: ['view_all_branches', 'production_order.create'],
    }),
    'branch-b',
    productionBranchRecord({ id: 'branch-b' }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.branchId, 'branch-b');
  }
});

test('create authorization rejects invalid branches from another organization', () => {
  const result = resolveProductionCreateBranchAuthorization(
    productionAuthContext({
      branchAssignments: [],
      branchId: null,
      isBranchScoped: false,
      permissions: ['view_all_branches', 'production_order.create'],
    }),
    'branch-z',
    productionBranchRecord({ id: 'branch-z', organizationId: 'org-2' }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.message, PRODUCTION_BRANCH_NOT_AVAILABLE);
  }
});

test('branch-scoped update authorization allows own-branch orders', () => {
  const result = resolveProductionUpdateBranchAuthorization({
    branch: null,
    ctx: productionAuthContext(),
    order: productionOrderRecord(),
    requestedBranchId: undefined,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.branchId, 'branch-a');
    assert.equal(result.value.order.id, 'order-1');
  }
});

test('branch-scoped update authorization rejects cross-branch moves', () => {
  const result = resolveProductionUpdateBranchAuthorization({
    branch: productionBranchRecord({ id: 'branch-b' }),
    ctx: productionAuthContext(),
    order: productionOrderRecord(),
    requestedBranchId: 'branch-b',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.equal(result.message, 'Forbidden');
  }
});

test('production order write authorization rejects another organization', () => {
  const result = authorizeProductionOrderForWrite(
    productionAuthContext(),
    productionOrderRecord({ organizationId: 'org-2' }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
    assert.equal(result.message, PRODUCTION_ORDER_NOT_FOUND);
  }
});

test('production order write authorization rejects null-branch orders for branch-scoped users', () => {
  const result = authorizeProductionOrderForWrite(
    productionAuthContext(),
    productionOrderRecord({ branchId: null }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.equal(result.message, 'Forbidden');
  }
});

test('production order create route uses forced branch scope before calling the RPC helper', async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const route = loadRouteModule<{ POST: (request: unknown) => Promise<Response> }>(
    'src/app/api/production/orders/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/inventory': {
        ensurePositiveQuantity(value: unknown) {
          return Number(value);
        },
      },
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async savePlannedProductionOrder(input: Record<string, unknown>) {
          capturedInput = input;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async resolveAuthorizedProductionCreateBranchId() {
          return { ok: true, value: { branchId: 'branch-a' } } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({
    branchId: 'branch-b',
    finishedGoodsWarehouseId: 'fg-wh',
    plannedQuantity: 12,
    productId: 'product-1',
    productionWarehouseId: 'prod-wh',
  }) as never);

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.branchId, 'branch-a');
});

test('production order update route rejects authorization failure before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ PUT: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/inventory': {
        ensurePositiveQuantity(value: unknown) {
          return Number(value);
        },
      },
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async savePlannedProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async resolveAuthorizedProductionUpdateBranchId() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
      },
    },
  );

  const response = await route.PUT(createMockJsonRequest({
    finishedGoodsWarehouseId: 'fg-wh',
    plannedQuantity: 12,
    productId: 'product-1',
    productionWarehouseId: 'prod-wh',
  }) as never, { params: Promise.resolve({ id: 'order-2' }) });

  assert.equal(response.status, 403);
  assert.equal(rpcCalled, false);
  assert.deepEqual(await response.json(), { error: 'Forbidden' });
});

test('release route rejects authorization failure before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/release/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/inventory': {
        ensurePositiveQuantity(value: unknown) {
          return Number(value);
        },
      },
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async releaseProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ releasedQuantity: 10 }) as never, {
    params: Promise.resolve({ id: 'order-2' }),
  });

  assert.equal(response.status, 403);
  assert.equal(rpcCalled, false);
});

test('issue route rejects authorization failure before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issue/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async postProductionIssue() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production': {
        isProductionDocumentDateInFuture() {
          return false;
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ lines: [{ itemId: 'item-1', quantity: 2 }] }) as never, {
    params: Promise.resolve({ id: 'order-2' }),
  });

  assert.equal(response.status, 403);
  assert.equal(rpcCalled, false);
});

test('receipt route rejects authorization failure before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipt/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/inventory': {
        ensureNonNegative(value: unknown) {
          return Number(value);
        },
      },
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async postProductionReceipt() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production': {
        isProductionDocumentDateInFuture() {
          return false;
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ completedQuantity: 10 }) as never, {
    params: Promise.resolve({ id: 'order-2' }),
  });

  assert.equal(response.status, 403);
  assert.equal(rpcCalled, false);
});

test('issue and receipt routes forward aligned document dates and idempotency keys to RPC helpers', async () => {
  let capturedIssueInput: Record<string, unknown> | null = null;
  const issueRoute = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issue/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async postProductionIssue(input: Record<string, unknown>) {
          capturedIssueInput = input;
          return { success: true };
        },
      },
      '@/lib/production': {
        isProductionDocumentDateInFuture() {
          return false;
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
      },
    },
  );

  const issueResponse = await issueRoute.POST(createMockJsonRequest({
    department: 'Mixing',
    issueDate: '2026-07-31',
    lines: [{ componentId: 'component-1', quantity: 2 }],
    remarks: 'Issue materials',
    shift: 'DAY',
  }, {
    headers: { 'idempotency-key': 'issue-key-1' },
  }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });

  assert.equal(issueResponse.status, 200);
  assert.equal(capturedIssueInput?.orderId, 'order-1');
  assert.equal(capturedIssueInput?.issueDate, '2026-07-31');
  assert.equal(capturedIssueInput?.idempotencyKey, 'issue-key-1');

  let capturedReceiptInput: Record<string, unknown> | null = null;
  const receiptRoute = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipt/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/inventory': {
        ensureNonNegative(value: unknown) {
          return Number(value);
        },
      },
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async postProductionReceipt(input: Record<string, unknown>) {
          capturedReceiptInput = input;
          return { success: true };
        },
      },
      '@/lib/production': {
        isProductionDocumentDateInFuture() {
          return false;
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
      },
    },
  );

  const receiptResponse = await receiptRoute.POST(createMockJsonRequest({
    batchNumber: 'LOT-001',
    completedQuantity: 10,
    expiryDate: '2026-08-15',
    productionDate: '2026-07-31',
    receiptDate: '2026-07-31',
    remarks: 'Receive finished goods',
  }, {
    headers: { 'idempotency-key': 'receipt-key-1' },
  }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });

  assert.equal(receiptResponse.status, 200);
  assert.equal(capturedReceiptInput?.orderId, 'order-1');
  assert.equal(capturedReceiptInput?.receiptDate, '2026-07-31');
  assert.equal(capturedReceiptInput?.productionDate, '2026-07-31');
  assert.equal(capturedReceiptInput?.idempotencyKey, 'receipt-key-1');
});

test('close route rejects authorization failure before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/close/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        closeProductionOrder: async () => {
          rpcCalled = true;
          return { success: true };
        },
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ closingNotes: 'close' }) as never, {
    params: Promise.resolve({ id: 'order-2' }),
  });

  assert.equal(response.status, 403);
  assert.equal(rpcCalled, false);
});

test('issue route rejects future issue dates before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issue/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async postProductionIssue() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production': {
        isProductionDocumentDateInFuture(value: string | null | undefined) {
          return value === '2026-08-01';
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({
    issueDate: '2026-08-01',
    lines: [{ componentId: 'component-1', currentIssueQuantity: 2 }],
  }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });

  assert.equal(response.status, 400);
  assert.equal(rpcCalled, false);
  assert.deepEqual(await response.json(), { error: 'issueDate cannot be in the future.' });
});

test('receipt route rejects future receipt dates before the RPC helper is called', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipt/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/inventory': {
        ensureNonNegative(value: unknown) {
          return Number(value);
        },
      },
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async postProductionReceipt() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production': {
        isProductionDocumentDateInFuture(value: string | null | undefined) {
          return value === '2026-08-01';
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({
    completedQuantity: 10,
    receiptDate: '2026-08-01',
  }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });

  assert.equal(response.status, 400);
  assert.equal(rpcCalled, false);
  assert.deepEqual(await response.json(), { error: 'receiptDate cannot be in the future.' });
});

test('issue reversal route allows authorized same-branch reversal', async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; issueId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionIssue(input: Record<string, unknown>) {
          capturedInput = input;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionIssueAuthorizationRecord() {
          return { id: 'issue-1', organizationId: 'org-1', postingStatus: 'POSTED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Cycle count correction' }) as never, {
    params: Promise.resolve({ id: 'order-1', issueId: 'issue-1' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, { issueId: 'issue-1', reason: 'Cycle count correction' });
});

test('issue reversal route rejects an empty reversal reason', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; issueId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionIssue() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionIssueAuthorizationRecord() {
          return { id: 'issue-1', organizationId: 'org-1', postingStatus: 'POSTED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: '   ' }) as never, {
    params: Promise.resolve({ id: 'order-1', issueId: 'issue-1' }),
  });

  assert.equal(response.status, 400);
  assert.equal(rpcCalled, false);
  assert.deepEqual(await response.json(), { error: 'Reversal reason is required.' });
});

test('issue reversal route rejects another organization or another order before the RPC helper', async () => {
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; issueId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionIssue() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionIssueAuthorizationRecord() {
          return { id: 'issue-9', organizationId: 'org-2', postingStatus: 'POSTED', productionOrderId: 'order-7' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Fix issue' }) as never, {
    params: Promise.resolve({ id: 'order-1', issueId: 'issue-9' }),
  });

  assert.equal(response.status, 404);
  assert.equal(rpcCalled, false);
});

test('issue reversal route rejects branch-scoped authorization failure before loading the issue', async () => {
  let issueLoaded = false;
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; issueId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionIssue() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
        async loadProductionIssueAuthorizationRecord() {
          issueLoaded = true;
          return { id: 'issue-1', organizationId: 'org-1', postingStatus: 'POSTED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Fix issue' }) as never, {
    params: Promise.resolve({ id: 'order-1', issueId: 'issue-1' }),
  });

  assert.equal(response.status, 403);
  assert.equal(issueLoaded, false);
  assert.equal(rpcCalled, false);
});

test('issue reversal route maps duplicate or already-reversed failures to a controlled error', async () => {
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; issueId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: error instanceof Error ? error.message : String(error), status: 409 };
        },
        async reverseProductionIssue() {
          throw new Error('Only POSTED production issues can be reversed.');
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionIssueAuthorizationRecord() {
          return { id: 'issue-1', organizationId: 'org-1', postingStatus: 'REVERSED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Retry' }) as never, {
    params: Promise.resolve({ id: 'order-1', issueId: 'issue-1' }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Only POSTED production issues can be reversed.' });
});

test('receipt reversal route allows authorized same-branch reversal', async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; receiptId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionReceipt(input: Record<string, unknown>) {
          capturedInput = input;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionReceiptAuthorizationRecord() {
          return { id: 'receipt-1', organizationId: 'org-1', postingStatus: 'POSTED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Return to released state' }) as never, {
    params: Promise.resolve({ id: 'order-1', receiptId: 'receipt-1' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, { reason: 'Return to released state', receiptId: 'receipt-1' });
});

test('receipt reversal route rejects empty reason, wrong order, and branch authorization failure before the RPC helper', async () => {
  let receiptLoaded = false;
  let rpcCalled = false;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; receiptId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionReceipt() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
        async loadProductionReceiptAuthorizationRecord() {
          receiptLoaded = true;
          return { id: 'receipt-9', organizationId: 'org-2', postingStatus: 'POSTED', productionOrderId: 'order-7' };
        },
      },
    },
  );

  const authFailure = await route.POST(createMockJsonRequest({ reason: 'Correct receipt' }) as never, {
    params: Promise.resolve({ id: 'order-1', receiptId: 'receipt-9' }),
  });
  assert.equal(authFailure.status, 403);
  assert.equal(receiptLoaded, false);
  assert.equal(rpcCalled, false);

  const routeWrongOrder = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; receiptId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionReceipt() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionReceiptAuthorizationRecord() {
          return { id: 'receipt-9', organizationId: 'org-1', postingStatus: 'POSTED', productionOrderId: 'order-7' };
        },
      },
    },
  );

  const wrongOrder = await routeWrongOrder.POST(createMockJsonRequest({ reason: 'Correct receipt' }) as never, {
    params: Promise.resolve({ id: 'order-1', receiptId: 'receipt-9' }),
  });
  assert.equal(wrongOrder.status, 404);
  assert.equal(rpcCalled, false);

  const routeEmptyReason = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; receiptId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reverseProductionReceipt() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionReceiptAuthorizationRecord() {
          return { id: 'receipt-1', organizationId: 'org-1', postingStatus: 'POSTED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const emptyReason = await routeEmptyReason.POST(createMockJsonRequest({ reason: '   ' }) as never, {
    params: Promise.resolve({ id: 'order-1', receiptId: 'receipt-1' }),
  });
  assert.equal(emptyReason.status, 400);
  assert.equal(rpcCalled, false);
});

test('receipt reversal route maps duplicate or already-reversed failures to a controlled error', async () => {
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string; receiptId: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: error instanceof Error ? error.message : String(error), status: 409 };
        },
        async reverseProductionReceipt() {
          throw new Error('Only POSTED production receipts can be reversed.');
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
        async loadProductionReceiptAuthorizationRecord() {
          return { id: 'receipt-1', organizationId: 'org-1', postingStatus: 'REVERSED', productionOrderId: 'order-1' };
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Retry' }) as never, {
    params: Promise.resolve({ id: 'order-1', receiptId: 'receipt-1' }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Only POSTED production receipts can be reversed.' });
});

test('reopen route allows an authorized CLOSED order with a required reason', async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const route = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/reopen/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reopenProductionOrder(input: Record<string, unknown>) {
          capturedInput = input;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'CLOSED' }) } as const;
        },
      },
    },
  );

  const response = await route.POST(createMockJsonRequest({ reason: 'Inventory correction requires reopened state' }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, { orderId: 'order-1', reason: 'Inventory correction requires reopened state' });
});

test('reopen route rejects non-CLOSED orders, empty reasons, cross-branch and cross-organization access, and missing permission', async () => {
  let rpcCalled = false;

  const routeNonClosed = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/reopen/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reopenProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'RELEASED' }) } as const;
        },
      },
    },
  );

  const nonClosed = await routeNonClosed.POST(createMockJsonRequest({ reason: 'Retry' }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });
  assert.equal(nonClosed.status, 409);
  assert.equal(rpcCalled, false);

  const routeEmptyReason = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/reopen/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reopenProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'CLOSED' }) } as const;
        },
      },
    },
  );

  const emptyReason = await routeEmptyReason.POST(createMockJsonRequest({ reason: ' ' }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });
  assert.equal(emptyReason.status, 400);
  assert.equal(rpcCalled, false);

  const routeCrossBranch = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/reopen/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reopenProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Forbidden', ok: false, status: 403 } as const;
        },
      },
    },
  );

  const crossBranch = await routeCrossBranch.POST(createMockJsonRequest({ reason: 'Retry' }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });
  assert.equal(crossBranch.status, 403);
  assert.equal(rpcCalled, false);

  const routeCrossOrg = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/reopen/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reopenProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { message: 'Production order not found.', ok: false, status: 404 } as const;
        },
      },
    },
  );

  const crossOrg = await routeCrossOrg.POST(createMockJsonRequest({ reason: 'Retry' }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });
  assert.equal(crossOrg.status, 404);
  assert.equal(rpcCalled, false);

  const routeForbidden = loadRouteModule<{ POST: (request: unknown, context: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'src/app/api/production/orders/[id]/reopen/route.ts',
    {
      '@/lib/api-auth': createApiAuthMock({
        branchAssignments: ['branch-a'],
        branchId: 'branch-a',
        isBranchScoped: true,
        organizationId: 'org-1',
      }, false),
      '@/lib/production-orders-server': {
        mapProductionRpcError(error: unknown) {
          return { message: String(error), status: 400 };
        },
        async reopenProductionOrder() {
          rpcCalled = true;
          return { success: true };
        },
      },
      '@/lib/production-server': {
        async authorizeProductionOrderWriteAccess() {
          return { ok: true, value: productionOrderRecord({ status: 'CLOSED' }) } as const;
        },
      },
    },
  );

  const forbidden = await routeForbidden.POST(createMockJsonRequest({ reason: 'Retry' }) as never, {
    params: Promise.resolve({ id: 'order-1' }),
  });
  assert.equal(forbidden.status, 403);
  assert.equal(rpcCalled, false);
});

test('reopen migration records status history and audit intent without invoking inventory reversal RPCs', () => {
  const migration = fs.readFileSync('migrations/042_production_reopen_and_relationship_links.sql', 'utf8');

  assert.match(migration, /insert into icecream_erp\.production_order_status_history/i);
  assert.match(migration, /insert into icecream_erp\.audit_logs/i);
  assert.match(migration, /'PRODUCTION_ORDER_REOPENED'/i);
  assert.doesNotMatch(migration, /reverse_production_issue/i);
  assert.doesNotMatch(migration, /reverse_production_receipt/i);
});

test('relationship map migration rebuilds the view from production_document_links without duplicate nodes', () => {
  const migration = fs.readFileSync('migrations/042_production_reopen_and_relationship_links.sql', 'utf8');

  assert.match(migration, /create or replace view icecream_erp\.production_order_relationship_map/i);
  assert.match(migration, /from icecream_erp\.production_document_links/i);
  assert.match(migration, /row_number\(\) over/i);
  assert.match(migration, /where rn = 1/i);
  assert.match(migration, /where dl\.related_document_type = 'production_issue'/i);
  assert.match(migration, /where dl\.related_document_type = 'production_receipt'/i);
  assert.doesNotMatch(migration, /from icecream_erp\.production_issues pi\s+union all/i);
});

test('production order detail page references reversal and reopen APIs, refreshes queries, and removes relationship-map mojibake', () => {
  const page = fs.readFileSync('src/app/(dashboard)/production/orders/[id]/page.tsx', 'utf8');
  const routes = fs.readFileSync('src/lib/shared/api-routes.ts', 'utf8');

  assert.match(routes, /ORDER_ISSUE_REVERSE/);
  assert.match(routes, /ORDER_RECEIPT_REVERSE/);
  assert.match(routes, /ORDER_REOPEN/);
  assert.match(page, /API_ROUTES\.PRODUCTION\.ORDER_ISSUE_REVERSE/);
  assert.match(page, /API_ROUTES\.PRODUCTION\.ORDER_RECEIPT_REVERSE/);
  assert.match(page, /API_ROUTES\.PRODUCTION\.ORDER_REOPEN/);
  assert.match(page, /reason: correctionReason/);
  assert.match(page, /invalidateQueries\(\{ queryKey: \['production'\] \}\)/);
  assert.match(page, /invalidateQueries\(\{ queryKey: \['production', 'order', id\] \}\)/);
  assert.match(page, /invalidateQueries\(\{ queryKey: \['production-batches'\] \}\)/);
  assert.doesNotMatch(page, /Â·/);
});

test('calculateRequiredMaterials scales ingredient demand and shortages', () => {
  const rows = calculateRequiredMaterials(
    [
      {
        item_id: 'item-1',
        items: { code: 'MIX-01', name: 'Ice cream mix' },
        quantity_required: 10,
        units_of_measure: { abbreviation: 'kg' },
        wastage_allowance_percent: 5,
      },
    ],
    200,
    100,
    new Map([['item-1', 15]]),
  );

  assert.equal(rows[0]?.requiredQuantity, 21);
  assert.equal(rows[0]?.shortageQuantity, 6);
});

test('BOM scaling helpers support lower and higher plan volumes', () => {
  assert.equal(calculateScalingFactor(5000, 10000), 0.5);
  assert.equal(calculateScalingFactor(20000, 10000), 2);

  const halfBatch = calculateScaledMaterialRequirement({
    plannedQuantity: 5000,
    quantityRequired: 100,
    standardOutputQuantity: 10000,
    standardUnitCost: 2.5,
  });
  const doubleBatch = calculateScaledMaterialRequirement({
    plannedQuantity: 20000,
    quantityRequired: 100,
    standardOutputQuantity: 10000,
    standardUnitCost: 2.5,
  });

  assert.equal(halfBatch.requiredQuantity, 50);
  assert.equal(halfBatch.estimatedMaterialCost, 125);
  assert.equal(doubleBatch.requiredQuantity, 200);
  assert.equal(doubleBatch.estimatedMaterialCost, 500);
});

test('variance, yield, productivity, and costing rows derive batch KPIs', () => {
  const batches = [
    {
      id: 'batch-1',
      actual_output: 180,
      batch_number: 'PB-001',
      expected_output: 200,
      production_batch_materials: [
        { items: { name: 'Ice cream mix', unit_cost: 3 }, quantity_actual: 40, quantity_required: 35 },
      ],
      recipes: { finished_item: { name: 'Chocolate Cone' } },
      shift: 'DAY',
    },
  ];

  const varianceRows = buildVarianceRows(batches);
  const yieldRows = buildYieldRows(batches);
  const productivityRows = buildProductivityRows(batches, new Map([['batch-1', 6]]));
  const costingRows = buildCostingRows(batches);

  assert.equal(varianceRows[0]?.outputVariance, -20);
  assert.equal(varianceRows[0]?.materialVariance, 5);
  assert.equal(yieldRows[0]?.yieldPercentage, 450);
  assert.equal(productivityRows[0]?.outputPerWorker, 30);
  assert.equal(costingRows[0]?.costPerUnit, 2 / 3);
});

test('shift performance merges actual output with targets', () => {
  const rows = buildShiftPerformanceRows(
    [
      { actual_output: 140, id: 'batch-1', production_date: '2026-06-12', shift: 'DAY' },
      { actual_output: 60, id: 'batch-2', production_date: '2026-06-12', shift: 'DAY' },
    ],
    [
      { shift: 'DAY', target_date: '2026-06-12', target_output_quantity: 250, target_workers: 8 },
    ],
    new Map([['batch-1', 3], ['batch-2', 4]]),
  );

  assert.equal(rows[0]?.actualOutput, 200);
  assert.equal(rows[0]?.targetOutput, 250);
  assert.equal(rows[0]?.workerCount, 8);
});

test('direct calculation helpers expose finance and workforce metrics', () => {
  assert.equal(calculateYieldPercentage(500, 100), 500);
  assert.equal(calculateProductivity(240, 8), 30);
  assert.equal(calculateCostPerUnit(600, 200), 3);
});

test('recipe import validation returns row level errors', () => {
  const result = validateRecipeImportRows([
    { ingredientCode: '', ingredientQuantity: 0, productCode: 'CONE', recipeCode: '' },
    { ingredientCode: 'MIX-01', ingredientQuantity: 4, productCode: 'CONE', recipeCode: 'RCP-1' },
  ]);

  assert.equal(result.errors.length, 3);
  assert.equal(result.rows.length, 1);
});

test('shift target import validation blocks invalid rows', () => {
  const result = validateShiftTargetImportRows([
    { productCode: '', targetOutputQuantity: 0, targetWorkers: 0 },
    { productCode: 'CONE', targetOutputQuantity: 120, targetWorkers: 4 },
  ]);

  assert.equal(result.errors.length, 3);
  assert.equal(result.rows.length, 1);
});

test('production stock receive helpers build stable request signatures and sort normalized items', () => {
  const normalized = normalizeProductionStockReceiveItems([
    { itemId: ' item-b ', quantity: '2', unitCost: '1.5' },
    { itemId: 'item-a', quantity: 5, unitCost: 2 },
    { itemId: 'item-b', quantity: 0, unitCost: 3 },
  ]);

  assert.deepEqual(normalized, [
    { itemId: 'item-a', quantity: 5, unitCost: 2 },
    { itemId: 'item-b', quantity: 2, unitCost: 1.5 },
  ]);

  const left = buildProductionStockReceiveSignature({
    destinationWarehouseId: 'prod-wh',
    items: [
      { itemId: 'item-b', quantity: 2, unitCost: 1.5 },
      { itemId: 'item-a', quantity: 5, unitCost: 2 },
    ],
    notes: 'Launch transfer',
    sourceWarehouseId: 'main-wh',
    transferDate: '2026-07-22',
  });
  const right = buildProductionStockReceiveSignature({
    destinationWarehouseId: 'prod-wh',
    items: [
      { itemId: 'item-a', quantity: 5, unitCost: 2 },
      { itemId: 'item-b', quantity: 2, unitCost: 1.5 },
    ],
    notes: 'Launch transfer',
    sourceWarehouseId: 'main-wh',
    transferDate: '2026-07-22',
  });

  assert.equal(left, right);
});

test('production stock receive failure payload keeps stage and db diagnostics', () => {
  const failure = buildProductionStockReceiveFailure({
    dbMessage: 'Warehouse not found or inactive.',
    destinationWarehouseId: 'prod-wh',
    itemId: 'item-1',
    message: 'Warehouse access denied.',
    quantity: 50,
    sourceWarehouseId: 'main-wh',
    stage: 'LOAD_WAREHOUSES',
  });

  assert.equal(failure.success, false);
  assert.equal(failure.code, 'PRODUCTION_STOCK_RECEIVE_FAILED');
  assert.equal(failure.stage, 'LOAD_WAREHOUSES');
  assert.equal(failure.message, 'LOAD_WAREHOUSES: Warehouse access denied.');
  assert.equal(failure.details.destinationWarehouseId, 'prod-wh');
  assert.equal(failure.details.quantity, 50);
  assert.equal(failure.details.dbMessage, 'Warehouse not found or inactive.');
});

test('production warehouse type resolver prefers PRODUCTION when available', () => {
  assert.equal(
    resolveWarehouseTypeForLive('production', ['PRODUCTION', 'RAW_MATERIALS']),
    'PRODUCTION',
  );
});

test('production warehouse type resolver falls back to WIP and GENERAL safely', () => {
  assert.equal(
    resolveWarehouseTypeForLive('production', ['WIP', 'RAW_MATERIALS']),
    'WIP',
  );
  assert.equal(resolveWarehouseTypeForLive('production', ['GENERAL']), 'GENERAL');
});

test('existing warehouse types normalize live compatibility aliases', () => {
  assert.deepEqual(
    getExistingWarehouseTypes([
      { warehouseType: 'PRODUCTION_MATERIALS' },
      { type: 'WIP' },
      { warehouse_type: 'RAW_MATERIALS' },
      { warehouseType: 'production_materials' },
    ]),
    ['PRODUCTION', 'WIP', 'RAW_MATERIALS'],
  );
});

test('production smoke warehouse type candidates create live-safe warehouses when none exist', () => {
  assert.deepEqual(resolveWarehouseTypeCandidatesForLive('production', []), [
    'PRODUCTION',
    'WIP',
    'GENERAL',
  ]);
  assert.deepEqual(resolveWarehouseTypeCandidatesForLive('raw', []), [
    'RAW_MATERIALS',
    'RAW_MATERIAL',
    'GENERAL',
  ]);
});

test('production smoke seed quantity does not require pre-existing source stock', () => {
  assert.equal(calculateProductionSmokeSeedQuantity(0, 5), 5);
  assert.equal(calculateProductionSmokeSeedQuantity(2, 5), 3);
  assert.equal(calculateProductionSmokeSeedQuantity(5, 5), 0);
});

test('production smoke setup failure exposes required stage codes', () => {
  const missingWarehouse = buildProductionSmokeSetupFailure({
    message: 'No raw warehouse could be resolved.',
    stage: 'WAREHOUSE_OR_SOURCE_STOCK_MISSING',
  });
  const seedUnavailable = buildProductionSmokeSetupFailure({
    message: 'Stock adjustment route is unavailable.',
    stage: 'SOURCE_STOCK_SEED_UNAVAILABLE',
  });

  assert.equal(missingWarehouse.code, 'PRODUCTION_SMOKE_SETUP_FAILED');
  assert.equal(missingWarehouse.stage, 'WAREHOUSE_OR_SOURCE_STOCK_MISSING');
  assert.equal(seedUnavailable.code, 'PRODUCTION_SMOKE_SETUP_FAILED');
  assert.equal(seedUnavailable.stage, 'SOURCE_STOCK_SEED_UNAVAILABLE');
});

test('production receive smoke setup sends explicit seed unitCost and totalValue while preserving zero', () => {
  const script = fs.readFileSync('scripts/smoke-production-receive.mjs', 'utf8');

  assert.match(script, /unitCost:\s*seedUnitCost/);
  assert.match(script, /totalValue:\s*seedTotalValue/);
  assert.match(script, /toNumber\(item\?\.unitCost \?\? item\?\.unit_cost, 0\)/);
});

test('production receive smoke checks existing source stock before reseeding', () => {
  const script = fs.readFileSync('scripts/smoke-production-receive.mjs', 'utf8');

  assert.match(script, /if \(currentAvailable >= TRANSFER_QUANTITY\)/);
  assert.match(script, /pass\('Source stock already available'\)/);
});

test('latest active BOM selection follows version, updated_at, then id ordering', () => {
  const selected = selectLatestActiveBom([
    { id: 'recipe-002', status: 'ACTIVE', updated_at: '2026-07-30T09:00:00Z', version: 2 },
    { id: 'recipe-003', status: 'ACTIVE', updated_at: '2026-07-30T09:00:00Z', version: 2 },
    { id: 'recipe-001', status: 'ACTIVE', updated_at: '2026-07-29T09:00:00Z', version: 2 },
    { id: 'recipe-004', status: 'DRAFT', updated_at: '2026-08-01T09:00:00Z', version: 99 },
    { id: 'recipe-000', status: 'ACTIVE', updated_at: '2026-07-31T09:00:00Z', version: 1 },
  ]);

  assert.equal(selected?.id, 'recipe-003');
});

test('production dashboard helper is zero-safe for empty organizations', () => {
  const dashboard = buildProductionOrdersDashboard({
    components: [],
    costs: [],
    issues: [],
    orders: [],
    receipts: [],
  });

  assert.deepEqual(dashboard.stats, {
    actualCost: 0,
    closedOrders: 0,
    costVariance: 0,
    ordersRequiringMaterials: 0,
    outstandingFinishedGoodsReceiptQuantity: 0,
    outstandingMaterialQuantity: 0,
    plannedCost: 0,
    plannedOrders: 0,
    releasedOrders: 0,
  });
  assert.deepEqual(dashboard.recentIssues, []);
  assert.deepEqual(dashboard.recentOrders, []);
  assert.deepEqual(dashboard.recentReceipts, []);
});

test('production dashboard helper derives order metrics and recent documents from modern tables', () => {
  const dashboard = buildProductionOrdersDashboard({
    components: [
      { issued_quantity: 4, production_order_id: 'order-1', released_quantity: 10, shortage_quantity: 1 },
      { issued_quantity: 6, production_order_id: 'order-2', released_quantity: 6, shortage_quantity: 0 },
    ],
    costs: [
      { actual_cost: 155, cost_variance: 5, planned_cost: 150, production_order_id: 'order-1' },
      { actual_cost: 95, cost_variance: -5, planned_cost: 100, production_order_id: 'order-2' },
    ],
    issues: [
      { id: 'issue-1', issue_date: '2026-07-31', issue_number: 'PI-001', posting_status: 'POSTED', production_order_id: 'order-1', total_quantity: 8, warehouse_name: 'Raw WH' },
    ],
    orders: [
      { actual_cost: 155, id: 'order-1', planned_cost: 150, production_order_number: 'PO-001', product_description_snapshot: 'Vanilla Tub', product_number: 'FG-001', remaining_quantity: 2, released_quantity: 10, status: 'RELEASED', updated_at: '2026-07-31T12:00:00Z' },
      { actual_cost: 95, id: 'order-2', planned_cost: 100, production_order_number: 'PO-002', product_description_snapshot: 'Chocolate Cone', product_number: 'FG-002', remaining_quantity: 0, released_quantity: 6, status: 'CLOSED', updated_at: '2026-07-30T08:00:00Z' },
      { actual_cost: 0, id: 'order-3', planned_cost: 75, production_order_number: 'PO-003', product_description_snapshot: 'Mango Cup', product_number: 'FG-003', remaining_quantity: 0, released_quantity: 0, status: 'PLANNED', updated_at: '2026-07-29T08:00:00Z' },
    ],
    receipts: [
      { id: 'receipt-1', posting_status: 'POSTED', production_order_id: 'order-1', receipt_date: '2026-07-31', receipt_number: 'PR-001', total_completed_quantity: 8, warehouse_name: 'FG WH' },
    ],
  });

  assert.equal(dashboard.stats.plannedOrders, 1);
  assert.equal(dashboard.stats.releasedOrders, 1);
  assert.equal(dashboard.stats.closedOrders, 1);
  assert.equal(dashboard.stats.ordersRequiringMaterials, 1);
  assert.equal(dashboard.stats.outstandingMaterialQuantity, 7);
  assert.equal(dashboard.stats.outstandingFinishedGoodsReceiptQuantity, 2);
  assert.equal(dashboard.stats.plannedCost, 250);
  assert.equal(dashboard.stats.actualCost, 250);
  assert.equal(dashboard.stats.costVariance, 0);
  assert.equal(dashboard.recentIssues[0]?.documentNumber, 'PI-001');
  assert.equal(dashboard.recentReceipts[0]?.documentNumber, 'PR-001');
  assert.equal(dashboard.recentOrders[0]?.productionOrderNumber, 'PO-001');
});

test('future document date helper treats August 1, 2026 as future relative to July 31, 2026', () => {
  assert.equal(isProductionDocumentDateInFuture('2026-07-31', '2026-07-31'), false);
  assert.equal(isProductionDocumentDateInFuture('2026-08-01', '2026-07-31'), true);
});

test('production navigation and dashboard target order workflow instead of legacy batch posting', () => {
  const nav = fs.readFileSync('src/components/production/production-nav.tsx', 'utf8');
  const dashboard = fs.readFileSync('src/components/production/production-dashboard.tsx', 'utf8');

  assert.match(nav, /\/production\/orders\/new/);
  assert.match(nav, /workflow=issue/);
  assert.match(nav, /workflow=receipt/);
  assert.doesNotMatch(nav, /stage=issue/);
  assert.doesNotMatch(nav, /stage=release/);
  assert.match(dashboard, /\/production\/orders\?workflow=issue&status=RELEASED/);
  assert.match(dashboard, /\/production\/orders\?workflow=receipt&status=RELEASED/);
  assert.match(dashboard, /\/production\/orders\/new/);
});

test('dashboard route reads modern production order tables and not legacy production_batches totals', () => {
  const route = fs.readFileSync('src/app/api/production/dashboard/route.ts', 'utf8');

  assert.match(route, /from\('production_orders'\)/);
  assert.match(route, /from\('production_order_components'\)/);
  assert.match(route, /from\('production_issues'\)/);
  assert.match(route, /from\('production_receipts'\)/);
  assert.match(route, /from\('production_order_cost_summary'\)/);
  assert.doesNotMatch(route, /from\('production_batches'\)/);
});

test('planned order pages route create and edit through the shared planning form', () => {
  const listPage = fs.readFileSync('src/app/(dashboard)/production/orders/page.tsx', 'utf8');
  const newPage = fs.readFileSync('src/app/(dashboard)/production/orders/new/page.tsx', 'utf8');
  const editPage = fs.readFileSync('src/app/(dashboard)/production/orders/[id]/edit/page.tsx', 'utf8');
  const detailPage = fs.readFileSync('src/app/(dashboard)/production/orders/[id]/page.tsx', 'utf8');
  const planningForm = fs.readFileSync('src/components/production/production-order-planning-form.tsx', 'utf8');

  assert.match(listPage, /\/production\/orders\/new/);
  assert.match(listPage, /\/production\/orders\/\$\{row\.id\}\/edit/);
  assert.match(newPage, /ProductionOrderPlanningForm mode=\"create\"/);
  assert.match(editPage, /ProductionOrderPlanningForm/);
  assert.match(detailPage, /Edit Planned Order/);
  assert.match(detailPage, /issueDate/);
  assert.match(detailPage, /receiptDate/);
  assert.match(planningForm, /Product Number/);
  assert.match(planningForm, /Calculated Material Requirements/);
  assert.match(planningForm, /Create Planned Order/);
  assert.match(planningForm, /Save Planned Order/);
});

test('legacy batch page is clearly marked legacy and points users back to production orders', () => {
  const legacyPage = fs.readFileSync('src/app/(dashboard)/production/batches/page.tsx', 'utf8');

  assert.match(legacyPage, /Legacy Batch Workflow/);
  assert.match(legacyPage, /Legacy batch screens are retained for historical compatibility/);
  assert.match(legacyPage, /New planning, issue posting, and receipt posting must be performed from Production Orders/);
});

test('production recipe workflow cards point to modern order issue and receipt flows instead of legacy batches', () => {
  const recipesPage = fs.readFileSync('src/app/(dashboard)/production/recipes/page.tsx', 'utf8');

  assert.match(recipesPage, /\/production\/orders\?workflow=issue&status=RELEASED/);
  assert.match(recipesPage, /\/production\/orders\?workflow=receipt&status=RELEASED/);
  assert.doesNotMatch(recipesPage, /\/production\/batches\?stage=issue/);
  assert.doesNotMatch(recipesPage, /\/production\/batches\?stage=release/);
  assert.match(recipesPage, /BOM \{'->'\} Issue \{'->'\} Receipt/);
});

test('production planning and BOM pages use the shared branch and item selector controls', () => {
  const planningForm = fs.readFileSync('src/components/production/production-order-planning-form.tsx', 'utf8');
  const recipesPage = fs.readFileSync('src/app/(dashboard)/production/recipes/page.tsx', 'utf8');

  assert.match(planningForm, /useAuthorizedBranches/);
  assert.match(planningForm, /useItemSelectorOptions/);
  assert.match(planningForm, /ItemSelectorField/);
  assert.match(planningForm, /limit: 250/);
  assert.match(planningForm, /onRetry=\{\(\) => productOptionsQuery\.refetch\(\)\}/);
  assert.match(recipesPage, /useItemSelectorOptions/);
  assert.match(recipesPage, /ItemSelectorField/);
  assert.match(recipesPage, /Search finished product/);
  assert.match(recipesPage, /limit: 250/);
  assert.match(recipesPage, /findDuplicateLineItems/);
  assert.match(recipesPage, /Saving BOM/);
  assert.match(recipesPage, /setCalculatorRecipeId/);
  assert.match(recipesPage, /onRetry=\{\(\) => finishedGoodsQuery\.refetch\(\)\}/);
});

test('production recipe route rejects duplicate recipe items with structured server errors', () => {
  const route = fs.readFileSync('src/app/api/production/recipes/route.ts', 'utf8');

  assert.match(route, /hasDuplicateRecipeItems/);
  assert.match(route, /Each raw material may only appear once in a BOM\./);
  assert.match(route, /Each packaging material may only appear once in a BOM\./);
  assert.match(route, /rollbackCreatedRecipe/);
  assert.match(route, /sort_order: index/);
  assert.match(route, /Saved BOM ingredient lines could not be confirmed after creation\./);
  assert.match(route, /apiServerError/);
});

test('production reports show a controlled zero-output costing notice and use compatibility fallback loading', () => {
  const reportsPage = fs.readFileSync('src/app/(dashboard)/production/reports/page.tsx', 'utf8');
  const productionServer = fs.readFileSync('src/lib/production-server.ts', 'utf8');

  assert.match(reportsPage, /Production cost per good unit is unavailable because no good output has been recorded\./);
  assert.match(reportsPage, /function ReportSection\(\{\s*columns,\s*description,\s*notice,\s*rows,\s*title,/s);
  assert.match(reportsPage, /Retry reports/);
  assert.match(productionServer, /isMissingRelationshipError/);
  assert.match(productionServer, /from\('production_batch_materials'\)/);
  assert.match(productionServer, /from\('production_batch_outputs'\)/);
  assert.match(productionServer, /from\('production_worker_assignments'\)/);
});
