/**
 * Initializes browser App Check with reCAPTCHA Enterprise and confines debug
 * tokens to local or test runtimes.
 */
import type { FirebaseApp } from 'firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';

export type AppCheckClientRuntime = 'local' | 'test' | 'production';

export type AppCheckScaffoldOptions = {
  readonly siteKey: string;
  /** When true, enables debug token flow for local/emulator (never commit tokens). */
  readonly debugToken?: string | boolean;
  /** Explicit runtime classification. Production must never accept debug tokens. */
  readonly runtime?: AppCheckClientRuntime;
};

function inferRuntime(): AppCheckClientRuntime {
  if (typeof process === 'undefined') {
    return 'production';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'local';
}

export function configureAppCheckDebugToken(
  debugToken: string | boolean | undefined,
  runtime: AppCheckClientRuntime,
): void {
  const target = globalThis as typeof globalThis & {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  };

  if (runtime === 'production') {
    delete target.FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (debugToken === undefined) {
      return;
    }
    throw new Error('Firebase App Check debug tokens are forbidden in production');
  }
  if (debugToken === undefined) {
    return;
  }
  target.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
}

export async function getAppCheckRequestHeaders(
  appCheck: AppCheck,
  forceRefresh = false,
): Promise<Readonly<Record<'X-Firebase-AppCheck', string>>> {
  const result = await getToken(appCheck, forceRefresh);
  return { 'X-Firebase-AppCheck': result.token };
}

/**
 * Initializes automatic App Check token refresh. Server-side policy determines
 * whether verification is monitor-only or enforced.
 */
export function initializeAppCheckScaffold(
  app: FirebaseApp,
  options: AppCheckScaffoldOptions,
): AppCheck {
  configureAppCheckDebugToken(options.debugToken, options.runtime ?? inferRuntime());

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(options.siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
