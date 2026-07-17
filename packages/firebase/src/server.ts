/**
 * Server-side Firebase Admin SDK initialization boundary.
 * Prefer Application Default Credentials or emulator mode; never commit keys.
 */
import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from 'firebase-admin/app';
import { parseServerFirebaseEnv, type ParsedFirebaseServerEnv } from './env.js';
import { applyAdminEmulatorEnvironment } from './emulators.js';
import type { EnvironmentLike } from './guard.js';

export type ServerFirebaseApp = {
  readonly app: App;
  readonly env: ParsedFirebaseServerEnv;
};

const SERVER_APP_NAME = 'black-book-server';

function buildCredential(environment: EnvironmentLike, credentials?: string) {
  if (!credentials) {
    return applicationDefault();
  }
  if (credentials.trim().startsWith('{')) {
    return cert(JSON.parse(credentials) as object);
  }
  // Path form is consumed via GOOGLE_APPLICATION_CREDENTIALS by ADC.
  if (!environment.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentials;
  }
  return applicationDefault();
}

/**
 * Initialize the Admin SDK. Emulator mode needs no credentials.
 */
export function createServerFirebaseApp(
  environment: EnvironmentLike = process.env,
): ServerFirebaseApp {
  const env = parseServerFirebaseEnv(environment);

  if (env.mode === 'emulator') {
    applyAdminEmulatorEnvironment(environment);
  }

  const existing = getApps().find((candidate) => candidate.name === SERVER_APP_NAME);
  if (existing) {
    return { app: existing, env };
  }

  const options: AppOptions = {
    projectId: env.projectId,
  };

  if (env.mode !== 'emulator') {
    options.credential = buildCredential(environment, env.credentials);
  }

  const app = initializeApp(options, SERVER_APP_NAME);
  return { app, env };
}

export function getServerFirebaseApp(): App {
  return getApp(SERVER_APP_NAME);
}
