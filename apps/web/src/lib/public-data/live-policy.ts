/**
 * Policy for when the web app should attempt live public projection reads.
 * Kept free of Admin SDK imports so unit tests do not load Firestore clients.
 */

/** Production Firebase project id (mirrors `@black-book/firebase` constants). */
const PRODUCTION_PROJECT_ID = 'black-book-efaaf';
const PRODUCTION_BREAK_GLASS_ENV = 'BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION';

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

/** Whether this runtime should attempt live public projection reads. */
export function shouldUseLivePublicProjections(
  env: EnvironmentLike = process.env,
): boolean {
  if (env.PUBLIC_READ_API_DISABLED === '1' || env.PUBLIC_READ_API_DISABLED === 'true') {
    return false;
  }
  if (env.PUBLIC_DATA_SOURCE === 'seed') {
    return false;
  }
  if (hasEmulatorSignals(env)) {
    return false;
  }

  const projectId =
    env.FIREBASE_PROJECT_ID?.trim() ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    env.GOOGLE_CLOUD_PROJECT?.trim();
  if (projectId !== PRODUCTION_PROJECT_ID && env.PUBLIC_DATA_SOURCE !== 'firestore') {
    return false;
  }

  const nodeEnv = env.NODE_ENV ?? env.BLACK_BOOK_ENV ?? 'development';
  if (nodeEnv !== 'production' && env[PRODUCTION_BREAK_GLASS_ENV] !== '1') {
    return false;
  }

  return true;
}
