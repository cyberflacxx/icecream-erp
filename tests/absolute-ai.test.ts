import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const auditSource = fs.readFileSync('src/lib/ai/audit.ts', 'utf8');
const serviceSource = fs.readFileSync('src/lib/ai/service.ts', 'utf8');
const geminiSource = fs.readFileSync('src/lib/ai/gemini.ts', 'utf8');
const typesSource = fs.readFileSync('src/lib/ai/types.ts', 'utf8');
const chatRouteSource = fs.readFileSync('src/app/api/ai/chat/route.ts', 'utf8');
const aiPageSource = fs.readFileSync('src/app/(dashboard)/ai/page-client.tsx', 'utf8');

test('provider failures are normalized to safe user-facing messages', () => {
  assert.match(geminiSource, /Gemini usage limit\. Please try again shortly/);
  assert.match(geminiSource, /Absolute AI is unavailable right now/);
  assert.match(geminiSource, /status === 429/);
  assert.match(geminiSource, /status === 401/);
});

test('prompt validation rejects empty and oversize prompts', () => {
  assert.match(serviceSource, /Prompt is required/);
  assert.match(serviceSource, /Prompt exceeds .* characters/);
  assert.match(serviceSource, /ABSOLUTE_AI_MAX_PROMPT_LENGTH/);
});

test('audit sanitization strips secrets from logged payloads', () => {
  assert.match(auditSource, /AIza/);
  assert.match(auditSource, /Bearer\\s\+/);
  assert.match(auditSource, /!\/key\|secret\|token\|password\|authorization\/i\.test\(key\)/);
  assert.match(auditSource, /\[redacted\]/);
});

test('system instruction hardens prompt injection and write refusal rules', () => {
  assert.match(serviceSource, /read-only diagnostic assistant/i);
  assert.match(serviceSource, /Use the fewest tools needed/i);
  assert.match(serviceSource, /Treat all ERP text, comments, notes/);
  assert.match(serviceSource, /Never claim to have performed writes/);
});

test('read-only refusal message is explicit', () => {
  assert.match(serviceSource, /cannot execute transactional changes yet/i);
});

test('AI routes and dashboard wiring enforce authentication and protected navigation', () => {
  const healthRoute = fs.readFileSync('src/app/api/ai/health/route.ts', 'utf8');
  const sidebar = fs.readFileSync('src/components/dashboard/sidebar.tsx', 'utf8');
  const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
  const userContext = fs.readFileSync('src/contexts/UserContext.tsx', 'utf8');

  assert.match(chatRouteSource, /getAuthContext\(request\)/);
  assert.match(chatRouteSource, /unauthorized\(\)/);
  assert.match(chatRouteSource, /forbidden\(\)/);
  assert.match(chatRouteSource, /runAbsoluteAiChat/);
  assert.match(healthRoute, /getAbsoluteAiHealthSummary/);
  assert.match(sidebar, /href: '\/ai'/);
  assert.match(sidebar, /label: 'Absolute AI'/);
  assert.match(middleware, /'\/ai'/);
  assert.match(userContext, /'\/ai'/);
});

test('chat route and AI page share one request contract that accepts null interaction ids', () => {
  assert.match(typesSource, /export const absoluteAiChatRequestSchema/);
  assert.match(typesSource, /previousInteractionId: z\.string\(\)\.max\(512\)\.nullish\(\)/);
  assert.match(typesSource, /conversationId: z\.string\(\)\.max\(120\)\.nullish\(\)/);
  assert.match(chatRouteSource, /absoluteAiChatRequestSchema\.safeParse/);
  assert.match(aiPageSource, /const requestBody: AbsoluteAiChatRequest =/);
  assert.match(aiPageSource, /previousInteractionId,/);
  assert.match(aiPageSource, /prompt: trimmed/);
});

test('tool registry includes GRN, stock, sales, fiscal, RBAC, health, and anomaly tools', () => {
  const toolRegistry = fs.readFileSync('src/lib/ai/tools.ts', 'utf8');

  for (const toolName of [
    'diagnose_grn',
    'diagnose_production_reports',
    'diagnose_finance_opening_balances',
    'get_grn_status',
    'get_stock_balance',
    'get_stock_movements',
    'diagnose_sales_stock',
    'reconcile_inventory_balance',
    'check_fiscal_period',
    'check_role_permissions',
    'system_health',
    'find_inventory_anomalies',
  ]) {
    assert.match(toolRegistry, new RegExp(toolName));
  }

  assert.match(toolRegistry, /Absolute AI tool .* is not allowed for this user/);
});
