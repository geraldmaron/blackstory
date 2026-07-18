
/**
 * Production-vs-emulator runtime guards for Firebase initialization.
 * Local and test runtimes default to demo emulators and refuse the production
 * project unless an explicit break-glass flag is set.
 */
import { DEMO_PROJECT_ID, PRODUCTION_BREAK_GLASS_ENV, PRODUCTION_PROJECT_ID } from './constants.js';

export type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export type FirebaseRuntimeMode = 'emulator' | 'production';

const LOCAL_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|host\.docker\.internal)(:\d+)?$/i;

export function isEmulatorHost(value: string): boolean {
  const normalized = value.includes('://') ? value : `http://${value}`;
  try {
    const parsed = new URL(normalized);
    return LOCAL_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function hasEmulatorSignals(environment: EnvironmentLike): boolean {
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

export function resolveFirebaseRuntimeMode(environment: EnvironmentLike): FirebaseRuntimeMode {
  return hasEmulatorSignals(environment) ? 'emulator' : 'production';
}

export function assertFirebaseProjectAllowed(
  projectId: string,
  environment: EnvironmentLike,
): FirebaseRuntimeMode {
  const mode = resolveFirebaseRuntimeMode(environment);
  const nodeEnv = environment.NODE_ENV ?? environment.BLAP_ENV ?? 'development';
  const breakGlass = environment[PRODUCTION_BREAK_GLASS_ENV] === '1';

  if (mode === 'emulator') {
    if (projectId === PRODUCTION_PROJECT_ID) {
      throw new Error(
        `Refusing production project "${PRODUCTION_PROJECT_ID}" while Firebase emulators are configured. ` +
          `Use "${DEMO_PROJECT_ID}" for local/emulator runs.`,
      );
    }
    if (!projectId.startsWith('demo-') && projectId !== DEMO_PROJECT_ID) {
      throw new Error(
        `Emulator mode requires a demo-* project id (expected "${DEMO_PROJECT_ID}"), got "${projectId}".`,
      );
    }
    return mode;
  }

  if (nodeEnv !== 'production' && !breakGlass) {
    throw new Error(
      'Local/non-production Firebase defaults to emulator-only. ' +
        'Set FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST (or FIREBASE_EMULATOR_MODE=1) ' +
        `for "${DEMO_PROJECT_ID}", or set ${PRODUCTION_BREAK_GLASS_ENV}=1 only for explicit production access.`,
    );
  }

  if (projectId !== PRODUCTION_PROJECT_ID) {
    throw new Error(
      `Production Firebase mode requires project "${PRODUCTION_PROJECT_ID}", got "${projectId}".`,
    );
  }

  return mode;
}
