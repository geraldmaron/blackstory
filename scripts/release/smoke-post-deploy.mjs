#!/usr/bin/env node

/**
 * Run post-deploy E2E smoke harness. Skips when E2E_BASE_URL unset; fail-closed when CI_REQUIRE_E2E=1.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const result = spawnSync('pnpm', ['test:e2e'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
