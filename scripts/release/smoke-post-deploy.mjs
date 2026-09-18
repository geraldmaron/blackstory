#!/usr/bin/env node

/**
 * Run post-deploy E2E smoke harness.
 * Skips when E2E_BASE_URL is unset; fail-closed when CI_REQUIRE_E2E=1 and URL is missing.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const baseUrl = (process.env.E2E_BASE_URL ?? '').trim();
const requireE2E = process.env.CI_REQUIRE_E2E === '1';

if (!baseUrl) {
  if (requireE2E) {
    console.error('CI_REQUIRE_E2E=1 but E2E_BASE_URL is unset');
    process.exit(1);
  }
  console.log('E2E_BASE_URL unset — skipping post-deploy smoke');
  process.exit(0);
}

const env = { ...process.env, E2E_BASE_URL: baseUrl };
const result = spawnSync('pnpm', ['test:e2e'], {
  cwd: ROOT,
  encoding: 'utf8',
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
