#!/usr/bin/env node

/**
 * Collects and evaluates the mobile store release gate.
 *
 * Thin spawn wrapper, matching scripts/launch/evaluate-beta-gate.mjs: the logic lives in
 * packages/testing/src/release-gates/mobile so it can be unit tested without a build host.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const entry = join(root, 'packages', 'testing', 'src', 'release-gates', 'mobile', 'cli-entry.ts');
const result = spawnSync(
  process.execPath,
  ['--conditions', 'development', '--import', 'tsx', entry, ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
