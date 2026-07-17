#!/usr/bin/env node

/**
 * Local release pipeline acceptance checks. Safe dry-run no cloud mutations.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PIPELINE = path.join(ROOT, 'infra/github/release-pipeline');

const steps = [
  ['node', [path.join(PIPELINE, 'release-pipeline.test.mjs')]],
  ['node', [path.join(ROOT, 'scripts/validate-github-governance.mjs')]],
];

for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Release pipeline local checks passed.');
