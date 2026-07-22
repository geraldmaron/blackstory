#!/usr/bin/env node

/**
 * Run post-deploy E2E smoke harness.
 * Skips when E2E_BASE_URL is unset; fail-closed when CI_REQUIRE_E2E=1 and URL is missing.
 * Clears production Firebase project env so test:preflight does not refuse the run.
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
// Deploy workflows set FIREBASE_PROJECT_ID to the live project for migrate/provenance.
// Preflight refuses that id; post-deploy smoke only needs a public HTTP base URL.
if (/black-book-efaaf|production/i.test(env.FIREBASE_PROJECT_ID ?? '')) {
  delete env.FIREBASE_PROJECT_ID;
  delete env.GCLOUD_PROJECT;
  delete env.GOOGLE_CLOUD_PROJECT;
}
env.FIREBASE_EMULATOR_MODE = env.FIREBASE_EMULATOR_MODE ?? '1';
env.FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID ?? 'demo-repo';

const result = spawnSync('pnpm', ['test:e2e'], {
  cwd: ROOT,
  encoding: 'utf8',
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
