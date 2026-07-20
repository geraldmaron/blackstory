/**
 * Public web Firebase client initialization boundary.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { parseWebFirebaseEnv, type ParsedFirebaseClientEnv } from './env.js';
import { connectClientEmulators } from './emulators.js';
import { initializeAppCheckScaffold } from './app-check.js';
import type { EnvironmentLike } from './guard.js';

export type WebFirebaseClient = {
  readonly app: FirebaseApp;
  readonly env: ParsedFirebaseClientEnv;
};

const WEB_APP_NAME = 'the related workstream';

/**
 * Initialize (or reuse) the public web Firebase app. Emulator hosts are connected
 * automatically when configured. App Check initializes only when a site key is set.
 */
export function createWebFirebaseClient(
  environment: EnvironmentLike = process.env,
): WebFirebaseClient {
  const env = parseWebFirebaseEnv(environment);
  const existing = getApps().find((candidate) => candidate.name === WEB_APP_NAME);
  const app = existing ?? initializeApp(env.config, WEB_APP_NAME);

  if (env.mode === 'emulator') {
    connectClientEmulators(app, environment);
  }

  if (env.appCheckSiteKey) {
    initializeAppCheckScaffold(app, { siteKey: env.appCheckSiteKey });
  }

  return { app, env };
}
