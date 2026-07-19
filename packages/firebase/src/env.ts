
/**
 * Typed environment schemas for Firebase web, admin, and server surfaces.
 * Local/test validation never requires production credentials.
 */
import { z } from 'zod';
import {
  ADMIN_APP_ID,
  DEMO_PROJECT_ID,
  PRODUCTION_API_KEY,
  PRODUCTION_AUTH_DOMAIN,
  PRODUCTION_MESSAGING_SENDER_ID,
  PRODUCTION_PROJECT_ID,
  PRODUCTION_STORAGE_BUCKET,
  WEB_APP_ID,
} from './constants.js';
import {
  assertFirebaseProjectAllowed,
  type EnvironmentLike,
  type FirebaseRuntimeMode,
  hasEmulatorSignals,
} from './guard.js';

const nonEmpty = z.string().trim().min(1);

export const firebaseClientConfigSchema = z.object({
  apiKey: nonEmpty,
  authDomain: nonEmpty,
  projectId: nonEmpty,
  storageBucket: nonEmpty,
  messagingSenderId: nonEmpty,
  appId: nonEmpty,
});

export type FirebaseClientConfig = z.infer<typeof firebaseClientConfigSchema>;

export type ParsedFirebaseClientEnv = {
  readonly mode: FirebaseRuntimeMode;
  readonly config: FirebaseClientConfig;
  readonly appCheckSiteKey?: string;
};

export type ParsedFirebaseServerEnv = {
  readonly mode: FirebaseRuntimeMode;
  readonly projectId: string;
  /** Optional path or JSON for Admin SDK; never required for local emulator tests. */
  readonly credentials?: string;
};

function emulatorClientDefaults(appId: string): FirebaseClientConfig {
  return {
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId: DEMO_PROJECT_ID,
    storageBucket: `${DEMO_PROJECT_ID}.appspot.com`,
    messagingSenderId: '123456789012',
    appId,
  };
}

function productionWebDefaults(): FirebaseClientConfig {
  return {
    apiKey: PRODUCTION_API_KEY,
    authDomain: PRODUCTION_AUTH_DOMAIN,
    projectId: PRODUCTION_PROJECT_ID,
    storageBucket: PRODUCTION_STORAGE_BUCKET,
    messagingSenderId: PRODUCTION_MESSAGING_SENDER_ID,
    appId: WEB_APP_ID,
  };
}

function productionAdminDefaults(): FirebaseClientConfig {
  return {
    ...productionWebDefaults(),
    appId: ADMIN_APP_ID,
  };
}

function readOptional(environment: EnvironmentLike, key: string): string | undefined {
  const value = environment[key];
  if (value === undefined || value.trim() === '') return undefined;
  return value.trim();
}

function mergeClientConfig(
  defaults: FirebaseClientConfig,
  environment: EnvironmentLike,
  appIdEnvKey: string,
): FirebaseClientConfig {
  return firebaseClientConfigSchema.parse({
    apiKey: readOptional(environment, 'NEXT_PUBLIC_FIREBASE_API_KEY') ?? defaults.apiKey,
    authDomain:
      readOptional(environment, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') ?? defaults.authDomain,
    projectId:
      readOptional(environment, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') ??
      readOptional(environment, 'FIREBASE_PROJECT_ID') ??
      defaults.projectId,
    storageBucket:
      readOptional(environment, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') ?? defaults.storageBucket,
    messagingSenderId:
      readOptional(environment, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') ??
      defaults.messagingSenderId,
    appId: readOptional(environment, appIdEnvKey) ?? defaults.appId,
  });
}


/**
 * Public web client env. Emulator mode supplies demo defaults; production uses
 * registered BlackStory Web identifiers unless overridden.
 */
export function parseWebFirebaseEnv(
  environment: EnvironmentLike = process.env,
): ParsedFirebaseClientEnv {
  const emulator = hasEmulatorSignals(environment);
  const defaults = emulator ? emulatorClientDefaults(WEB_APP_ID) : productionWebDefaults();
  const config = mergeClientConfig(defaults, environment, 'NEXT_PUBLIC_FIREBASE_APP_ID');
  const mode = assertFirebaseProjectAllowed(config.projectId, environment);
  const appCheckSiteKey = readOptional(environment, 'NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY');
  return appCheckSiteKey ? { mode, config, appCheckSiteKey } : { mode, config };
}


/**
 * Admin console client env. Uses the separate BlackStory Admin app id.
 */
export function parseAdminFirebaseEnv(
  environment: EnvironmentLike = process.env,
): ParsedFirebaseClientEnv {
  const emulator = hasEmulatorSignals(environment);
  const defaults = emulator ? emulatorClientDefaults(ADMIN_APP_ID) : productionAdminDefaults();
  const config = mergeClientConfig(defaults, environment, 'NEXT_PUBLIC_FIREBASE_ADMIN_APP_ID');
  const mode = assertFirebaseProjectAllowed(config.projectId, environment);
  const appCheckSiteKey = readOptional(environment, 'NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY');
  return appCheckSiteKey ? { mode, config, appCheckSiteKey } : { mode, config };
}


/**
 * Server Admin SDK env. Local tests need only emulator signals + demo project.
 */
export function parseServerFirebaseEnv(
  environment: EnvironmentLike = process.env,
): ParsedFirebaseServerEnv {
  const emulator = hasEmulatorSignals(environment);
  const projectId =
    readOptional(environment, 'FIREBASE_PROJECT_ID') ??
    readOptional(environment, 'GOOGLE_CLOUD_PROJECT') ??
    (emulator ? DEMO_PROJECT_ID : PRODUCTION_PROJECT_ID);
  const mode = assertFirebaseProjectAllowed(projectId, environment);
  const credentials =
    readOptional(environment, 'GOOGLE_APPLICATION_CREDENTIALS') ??
    readOptional(environment, 'FIREBASE_ADMIN_CREDENTIALS_JSON');
  return credentials ? { mode, projectId, credentials } : { mode, projectId };
}
