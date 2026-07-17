#!/usr/bin/env node
/**
 * Dry-run IAM matrix checker for BB-020. Ensures retention matrix and deny-delete design align.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyIamMatrixDesign } from './lib/verification.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MATRIX_PATH = path.join(ROOT, 'infra/firebase/backup/retention-matrix.json');

const RUNTIME_SAS = [
  'web-runtime',
  'api-public',
  'api-submissions',
  'api-internal',
  'admin',
  'publication',
  'research',
  'security',
  'migrations',
  'github-deploy',
];

async function main() {
  const matrix = JSON.parse(await readFile(MATRIX_PATH, 'utf8'));
  const result = verifyIamMatrixDesign(matrix, RUNTIME_SAS);

  console.log('BB-020 IAM matrix dry-run');
  console.log(`Backup bucket: ${matrix.backupBucket}`);
  console.log(`Runtime SAs denied delete: ${result.deniedDeletePrincipals.join(', ')}`);
  console.log(`Result: ${result.ok ? 'PASS' : 'FAIL'}`);
  if (!result.ok) {
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
