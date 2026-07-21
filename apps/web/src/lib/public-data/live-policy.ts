/**
 * Policy for when the web app should attempt live public projection reads.
 * Kept free of Admin SDK imports so unit tests do not load Firestore clients.
 */

import { GCP_PROJECT_ID_PROD } from '@repo/config/identity';

/** Production Firebase project id (immutable legacy GCP id). */
const PRODUCTION_PROJECT_ID = GCP_PROJECT_ID_PROD;
const PRODUCTION_BREAK_GLASS_ENV = 'APP_FIREBASE_ALLOW_PRODUCTION';

export type PublicDataSource = 'seed' | 'firestore' | 'postgres';

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

const LOCAL_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|host\.docker\.internal)(:\d+)?$/i;

function isEmulatorHost(value: string): boolean {
  const normalized = value.includes('://') ? value : `http://${value}`;
  try {
    const parsed = new URL(normalized);
    return LOCAL_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

function hasEmulatorSignals(environment: EnvironmentLike): boolean {
  if (environment.FIREBASE_EMULATOR_MODE === '1') return true;
  for (const key of [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST',
  ] as const) {
    const value = environment[key];
    if (value && isEmulatorHost(value)) return true;
  }
  return false;
}

export function resolvePublicDataSource(env: EnvironmentLike = process.env): PublicDataSource | undefined {
  const raw = env.PUBLIC_DATA_SOURCE?.trim().toLowerCase();
  if (raw === 'seed' || raw === 'firestore' || raw === 'postgres') {
    return raw;
  }
  return undefined;
}

export function isPostgresPublicDataSource(env: EnvironmentLike = process.env): boolean {
  return resolvePublicDataSource(env) === 'postgres';
}

function hasPostgresConnection(env: EnvironmentLike): boolean {
  return Boolean(env.DATABASE_URL?.trim() || env.APP_DATABASE_URL?.trim());
}

/** Whether this runtime should attempt live public projection reads.  */
export function shouldUseLivePublicProjections(env: EnvironmentLike = process.env): boolean {
  if (env.PUBLIC_READ_API_DISABLED === '1' || env.PUBLIC_READ_API_DISABLED === 'true') {
    return false;
  }
  if (env.PUBLIC_DATA_SOURCE === 'seed') {
    return false;
  }
  if (hasEmulatorSignals(env)) {
    return false;
  }

  if (isPostgresPublicDataSource(env)) {
    return hasPostgresConnection(env);
  }

  const projectId =
    env.FIREBASE_PROJECT_ID?.trim() ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    env.GOOGLE_CLOUD_PROJECT?.trim();
  if (projectId !== PRODUCTION_PROJECT_ID && env.PUBLIC_DATA_SOURCE !== 'firestore') {
    return false;
  }

  const nodeEnv = env.NODE_ENV ?? env.APP_ENV ?? 'development';
  if (nodeEnv !== 'production' && env[PRODUCTION_BREAK_GLASS_ENV] !== '1') {
    return false;
  }

  return true;
}
