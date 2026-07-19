#!/usr/bin/env node
/**
 * App Hosting build entrypoint shared by every backend at this rootDirectory ("."). Branches on
 * GOOGLE_BUILDABLE so each backend's apphosting.<environment>.yaml can point at its own app
 * without needing its own top-level `apphosting:build` script name (App Hosting's Next.js
 * adapter always resolves that one script name at the repo root).
 *
 * Each branch mirrors the pattern already proven for apps/web: build the target app's workspace
 * dependency chain, then copy `.next/static` + `public` into the standalone bundle (required for
 * CSS/JS when the backend's `scripts.runCommand` starts the standalone server directly).
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';

const buildable = process.env.GOOGLE_BUILDABLE ?? 'apps/web';

const APPS = {
  'apps/web': { filter: '@repo/web' },
  'apps/admin': { filter: '@repo/admin' },
};

const app = APPS[buildable];
if (!app) {
  throw new Error(`Unknown GOOGLE_BUILDABLE "${buildable}" — add it to scripts/apphosting-build.mjs`);
}

execSync(`pnpm --filter ${app.filter}... --workspace-concurrency=1 build`, { stdio: 'inherit' });

const standaloneNext = `${buildable}/.next/standalone/${buildable}/.next`;
mkdirSync(standaloneNext, { recursive: true });
cpSync(`${buildable}/.next/static`, `${standaloneNext}/static`, { recursive: true });
cpSync(`${buildable}/public`, `${buildable}/.next/standalone/${buildable}/public`, { recursive: true });
