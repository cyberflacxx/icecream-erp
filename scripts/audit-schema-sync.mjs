import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');
const migrationsRoot = path.join(repoRoot, 'migrations');

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/audit-schema-sync.mjs <inventory-dir>',
      '',
      'Expected files inside <inventory-dir>:',
      '  tables.tsv       table_name',
      '  columns.tsv      table_name<TAB>column_name<TAB>data_type<TAB>is_nullable<TAB>column_default',
      '  rls.tsv          schemaname<TAB>tablename<TAB>rowsecurity',
      '  constraints.tsv  table_name<TAB>constraint_name<TAB>constraint_type<TAB>column_name<TAB>foreign_table_name<TAB>foreign_column_name',
      '  indexes.tsv      tablename<TAB>indexname<TAB>indexdef',
    ].join('\n')
  );
}

function readTsv(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

function walkFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function collectTableReferences() {
  const fromPattern = /\.from\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g;
  const refs = new Map();

  for (const filePath of walkFiles(srcRoot)) {
    const relPath = path.relative(repoRoot, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(fromPattern)) {
      const table = match[1];
      const files = refs.get(table) ?? new Set();
      files.add(relPath);
      refs.set(table, files);
    }
  }

  return refs;
}

function collectMigrationBackedTables() {
  const tables = new Set();
  const migrationFiles = fs
    .readdirSync(migrationsRoot)
    .filter((file) => /^\d{3}_.*\.sql$/.test(file))
    .filter((file) => file !== '001_icecream_erp_schema.sql' && file !== '030_full_schema_contract_recovery.sql');

  for (const file of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsRoot, file), 'utf8');
    for (const match of content.matchAll(/icecream_erp\.([a-zA-Z0-9_]+)/g)) {
      tables.add(match[1]);
    }
  }

  return tables;
}

function main() {
  const inventoryDir = process.argv[2];
  const outputPath = process.argv[3] ? path.resolve(repoRoot, process.argv[3]) : null;
  if (!inventoryDir) {
    usage();
    process.exit(1);
  }

  const resolvedDir = path.resolve(repoRoot, inventoryDir);
  const requiredFiles = [
    'tables.tsv',
    'columns.tsv',
    'rls.tsv',
    'constraints.tsv',
    'indexes.tsv',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(resolvedDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing inventory file: ${filePath}`);
      process.exit(1);
    }
  }

  const liveTables = new Set(readTsv(path.join(resolvedDir, 'tables.tsv')).map(([table]) => table));
  const liveColumns = new Map();
  for (const [table, column] of readTsv(path.join(resolvedDir, 'columns.tsv'))) {
    const columns = liveColumns.get(table) ?? new Set();
    columns.add(column);
    liveColumns.set(table, columns);
  }

  const refs = collectTableReferences();
  const migrationBackedTables = collectMigrationBackedTables();
  const missingTables = [...refs.entries()]
    .filter(([table]) => !liveTables.has(table))
    .map(([table, files]) => ({
      files: [...files].sort(),
      hasMigrationCoverage: migrationBackedTables.has(table),
      table,
    }))
    .sort((a, b) => a.table.localeCompare(b.table));

  const missingTablesFromMigrations = missingTables.filter((entry) => entry.hasMigrationCoverage);
  const missingAppOnlyTables = missingTables.filter((entry) => !entry.hasMigrationCoverage);

  const rlsRows = readTsv(path.join(resolvedDir, 'rls.tsv'));
  const disabledRls = rlsRows
    .filter(([, , rowsecurity]) => rowsecurity !== 't' && rowsecurity.toLowerCase() !== 'true')
    .map(([, table]) => table)
    .sort();

  const summary = {
    liveTableCount: liveTables.size,
    referencedTableCount: refs.size,
    missingTableCount: missingTables.length,
    missingTablesFromMigrationsCount: missingTablesFromMigrations.length,
    missingAppOnlyTablesCount: missingAppOnlyTables.length,
    disabledRlsCount: disabledRls.length,
  };

  const payload = {
    summary,
    missingTables,
    missingTablesFromMigrations,
    missingAppOnlyTables,
    disabledRls,
  };

  if (outputPath) {
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
