/**
 * Firebase App Check scaffolding for BB-011.
 * Registration / client init helpers only — enforcement is BB-024.
 */
import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';

export type AppCheckScaffoldOptions = {
  readonly siteKey: string;
  /** When true, enables debug token flow for local/emulator (never commit tokens). */
  readonly debugToken?: string | boolean;
};

/**
 * Initialize App Check in monitoring-friendly form. Callers must supply a
 * reCAPTCHA Enterprise site key from env; do not enforce backend checks here.
 */
export function initializeAppCheckScaffold(
  app: FirebaseApp,
  options: AppCheckScaffoldOptions,
): AppCheck {
  if (options.debugToken !== undefined && typeof globalThis !== 'undefined') {
    const target = globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
    };
    target.FIREBASE_APPCHECK_DEBUG_TOKEN = options.debugToken;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(options.siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
