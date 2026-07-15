import fs from 'node:fs';
import path from 'node:path';

function readTsv(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

function main() {
  const inventoryDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(process.cwd(), '.tmp-schema-inventory');
  const auditJsonPath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : null;

  const tables = readTsv(path.join(inventoryDir, 'tables.tsv')).map(([table]) => table);
  const rlsRows = readTsv(path.join(inventoryDir, 'rls.tsv'));
  const disabledRls = rlsRows
    .filter(([, , rowsecurity]) => !['t', 'true'].includes(String(rowsecurity).toLowerCase()))
    .map(([, table]) => table)
    .sort();

  let appAudit = null;
  if (auditJsonPath && fs.existsSync(auditJsonPath)) {
    appAudit = JSON.parse(fs.readFileSync(auditJsonPath, 'utf8'));
  }

  const payload = {
    inventoryDir,
    liveTableCount: tables.length,
    liveTables: tables,
    disabledRlsCount: disabledRls.length,
    disabledRls,
    appAuditSummary: appAudit?.summary ?? null,
    generatedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(payload, null, 2));
}

main();
