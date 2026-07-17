#!/usr/bin/env node

/**
 * Evaluates beta launch gate criteria and exits non-zero on NO_GO.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const entry = join(root, 'packages', 'testing', 'src', 'launch-gate', 'cli-entry.ts');
const result = spawnSync(
  process.execPath,
  ['--conditions', 'development', '--import', 'tsx', entry, ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
