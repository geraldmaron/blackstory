
/**
 * Admin console Firebase client initialization boundary.
 * Authorization remains IAP/server-side; this only configures the client SDK.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { parseAdminFirebaseEnv, type ParsedFirebaseClientEnv } from './env.js';
import { connectClientEmulators } from './emulators.js';
import type { EnvironmentLike } from './guard.js';

export type AdminFirebaseClient = {
  readonly app: FirebaseApp;
  readonly env: ParsedFirebaseClientEnv;
};

const ADMIN_APP_NAME = 'the related workstream';


/**
 * Initialize (or reuse) the admin Firebase app under a distinct named instance.
 */
export function createAdminFirebaseClient(
  environment: EnvironmentLike = process.env,
): AdminFirebaseClient {
  const env = parseAdminFirebaseEnv(environment);
  const existing = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME);
  const app = existing ?? initializeApp(env.config, ADMIN_APP_NAME);

  if (env.mode === 'emulator') {
    connectClientEmulators(app, environment);
  }

  return { app, env };
}
