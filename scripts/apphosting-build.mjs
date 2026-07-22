#!/usr/bin/env node
/**
 * App Hosting build entrypoint for the admin backend (`apphosting.admin.yaml`).
 * Public web no longer uses App Hosting (Vercel — ADR-027). Branches on
 * APPHOSTING_BUILD_TARGET so the Firebase Next.js adapter can resolve a single
 * root `apphosting:build` script name.
 *
 * Builds the admin workspace dependency chain, then copies `.next/static` + `public`
 * into the standalone bundle (required when `scripts.runCommand` starts the
 * standalone server directly).
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';

const buildable = process.env.APPHOSTING_BUILD_TARGET ?? 'apps/admin';

const APPS = {
  'apps/admin': { filter: '@repo/admin' },
};

const app = APPS[buildable];
if (!app) {
  throw new Error(
    `Unknown APPHOSTING_BUILD_TARGET "${buildable}" — public web App Hosting is retired; only apps/admin is supported.`,
  );
}

execSync(`pnpm --filter ${app.filter}... --workspace-concurrency=1 build`, { stdio: 'inherit' });

const standaloneNext = `${buildable}/.next/standalone/${buildable}/.next`;
mkdirSync(standaloneNext, { recursive: true });
cpSync(`${buildable}/.next/static`, `${standaloneNext}/static`, { recursive: true });
cpSync(`${buildable}/public`, `${buildable}/.next/standalone/${buildable}/public`, {
  recursive: true,
});
