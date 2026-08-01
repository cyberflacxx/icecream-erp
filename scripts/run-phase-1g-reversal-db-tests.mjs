#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const mode = process.argv[2] === 'concurrency' ? 'concurrency' : 'integration';
const required = process.argv.includes('--required');
const env = { ...process.env };

function loadDotEnv(fileName) {
  const filePath = path.join(root, fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in env)) env[key] = value;
  }
}

loadDotEnv('.env');
loadDotEnv('.env.local');

const enabled = String(env.PHASE_1G_DB_TESTS ?? '').trim() === '1';
if (!enabled) {
  if (required) {
    console.error(
      `[phase-1g-db-tests] ${mode} requires PHASE_1G_DB_TESTS=1, PHASE_1G_DB_ISOLATED=1, a dedicated non-production DATABASE_URL, and psql on PATH.`,
    );
    process.exit(1);
  }
  console.log(`[phase-1g-db-tests] skipped ${mode}: set PHASE_1G_DB_TESTS=1 for an isolated database target.`);
  process.exit(0);
}

const databaseUrl = String(env.DATABASE_URL ?? '').trim();
if (!databaseUrl) {
  console.error('[phase-1g-db-tests] DATABASE_URL is required when PHASE_1G_DB_TESTS=1.');
  process.exit(1);
}

if (String(env.PHASE_1G_DB_ISOLATED ?? '').trim() !== '1') {
  console.error('[phase-1g-db-tests] Refusing to run without PHASE_1G_DB_ISOLATED=1.');
  process.exit(1);
}

const psqlProbe = spawnSync('psql', ['--version'], { cwd: root, env, encoding: 'utf8' });
if (psqlProbe.status !== 0) {
  console.error('[phase-1g-db-tests] psql is not available on PATH.');
  process.exit(1);
}

const sqlFile = mode === 'concurrency'
  ? path.join('migrations', 'manual', '045_inventory_operational_reversals.vps-concurrency-test.sql')
  : path.join('migrations', 'manual', '045_inventory_operational_reversals.vps-transaction-test.sql');

const run = spawnSync(
  'psql',
  [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-f', sqlFile],
  {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: 'inherit',
  },
);

process.exit(run.status ?? 1);
