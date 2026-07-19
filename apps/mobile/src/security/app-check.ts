/**
 * App Check integration for the native reader (MOB-010).
 *
 * Wires `@react-native-firebase/app` + `@react-native-firebase/app-check`
 * (ADR-020 §3: native attestation only — App Attest / DeviceCheck on iOS,
 * Play Integrity on Android — NOT the web SDK's reCAPTCHA provider). This
 * module owns two responsibilities:
 *
 *  1. `resolveAppCheckProviderConfig` — a PURE function that decides which
 *     attestation provider to use per platform and whether the debug provider
 *     is permitted. It performs no native I/O so it is deterministically
 *     unit-testable (see app-check.test.ts). The debug provider is gated to
 *     `__DEV__` AND a non-production `APP_VARIANT`; it is *statically
 *     unreachable* under the production profile (threat-model T1; the debug
 *     provider bypasses genuine attestation, so it must never ship).
 *
 *  2. `initializeAppCheckClient` — the runtime side effect. It loads the
 *     native modules DEFENSIVELY (guarded `require` in a try/catch) so that a
 *     dev/CI build with no registered Firebase app and no committed
 *     `GoogleService-Info.plist` / `google-services.json` (a human gate — see
 *     mobile-identity.md and app.config.ts's TODO(MOB-010)) DEGRADES rather
 *     than crashing. A missing native config file is an expected state today,
 *     not an error.
 *
 * App Check is ATTESTATION, NOT AUTHORIZATION (invariant 6, ADR-010): nothing
 * here gates data access. It only produces a token the API client attaches as
 * an abuse *signal* (see api-client.ts). Raw tokens are never logged
 * (invariant 7, ADR-020 §3) — see log-redaction.ts.
 */

// Type-only import: erased at compile time, so importing this module never
// triggers a native module load. The runtime load is the guarded require in
// `loadNativeAppCheck` below.
import type {
  ReactNativeFirebaseAppCheckProvider as ProviderClass,
  initializeAppCheck as InitializeAppCheckFn,
  getToken as GetTokenFn,
} from '@react-native-firebase/app-check';
import type { getApp as GetAppFn } from '@react-native-firebase/app';

export type AppVariant = 'development' | 'preview' | 'production';

/** iOS provider options per ReactNativeFirebaseAppCheckProviderAppleOptions. */
export type AppleAppCheckProvider =
  | 'debug'
  | 'deviceCheck'
  | 'appAttest'
  | 'appAttestWithDeviceCheckFallback';

/** Android provider options per ReactNativeFirebaseAppCheckProviderAndroidOptions. */
export type AndroidAppCheckProvider = 'debug' | 'playIntegrity';

export interface AppCheckProviderConfig {
  readonly apple: AppleAppCheckProvider;
  readonly android: AndroidAppCheckProvider;
  /**
   * True only when the debug provider is in use. MUST be false for any
   * production build. Tests assert this is statically false under the
   * production profile.
   */
  readonly debugProviderEnabled: boolean;
}

export interface ResolveProviderInput {
  readonly variant: AppVariant;
  /** `__DEV__` — true in a Metro/dev build, false in a release bundle. */
  readonly isDev: boolean;
}

/**
 * Decide the App Check provider per platform.
 *
 * Production always uses hardware-backed attestation:
 *   - iOS:  `appAttestWithDeviceCheckFallback` (App Attest on iOS 14+, falling
 *           back to DeviceCheck on older devices — ADR-020 §3).
 *   - Android: `playIntegrity`.
 *
 * The `debug` provider is permitted ONLY when BOTH:
 *   - the build is a dev build (`isDev === true`, i.e. `__DEV__`), AND
 *   - the variant is not `production`.
 *
 * The two conditions are independent guards (defence in depth): even a
 * mis-set `isDev === true` cannot enable the debug provider on the production
 * variant, and a production build (`isDev === false`) can never enable it
 * regardless of variant. This is the "statically-false-in-production" gate the
 * bead requires.
 */
export function resolveAppCheckProviderConfig(
  input: ResolveProviderInput,
): AppCheckProviderConfig {
  const debugAllowed = input.isDev && input.variant !== 'production';

  if (debugAllowed) {
    return {
      apple: 'debug',
      android: 'debug',
      debugProviderEnabled: true,
    };
  }

  return {
    apple: 'appAttestWithDeviceCheckFallback',
    android: 'playIntegrity',
    debugProviderEnabled: false,
  };
}

/** Shape of the native App Check surface we consume, kept minimal. */
interface NativeAppCheck {
  readonly getApp: typeof GetAppFn;
  readonly ReactNativeFirebaseAppCheckProvider: typeof ProviderClass;
  readonly initializeAppCheck: typeof InitializeAppCheckFn;
  readonly getToken: typeof GetTokenFn;
}

/**
 * Load the native RN Firebase App Check modules defensively.
 *
 * Returns `null` (never throws) when the modules or their native backing are
 * absent — the expected state in a dev/CI build with no registered Firebase
 * app and no committed config file. A `require` is used (not a static import)
 * so this load is lazy and catchable; the type safety comes from the
 * `import type` above.
 */
function loadNativeAppCheck(): NativeAppCheck | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appCheck = require('@react-native-firebase/app-check') as {
      ReactNativeFirebaseAppCheckProvider: typeof ProviderClass;
      initializeAppCheck: typeof InitializeAppCheckFn;
      getToken: typeof GetTokenFn;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const app = require('@react-native-firebase/app') as {
      getApp: typeof GetAppFn;
    };
    if (
      typeof appCheck?.initializeAppCheck !== 'function' ||
      typeof app?.getApp !== 'function'
    ) {
      return null;
    }
    return {
      getApp: app.getApp,
      ReactNativeFirebaseAppCheckProvider:
        appCheck.ReactNativeFirebaseAppCheckProvider,
      initializeAppCheck: appCheck.initializeAppCheck,
      getToken: appCheck.getToken,
    };
  } catch {
    return null;
  }
}

export type AppCheckInitResult =
  | { readonly initialized: true; readonly debugProviderEnabled: boolean }
  | { readonly initialized: false; readonly reason: string };

/** Module-scoped handle to the initialized App Check instance, if any. */
let appCheckInstance: unknown = null;
let loadedNative: NativeAppCheck | null = null;

export interface InitializeAppCheckInput extends ResolveProviderInput {
  /**
   * Override the native loader (tests inject a fake). Defaults to the real
   * guarded loader.
   */
  readonly loadNative?: () => NativeAppCheck | null;
}

/**
 * Initialize App Check. Safe to call on every cold start.
 *
 * Never throws: if the native modules or Firebase config are absent (human
 * gate not yet cleared), it returns `{ initialized: false, reason }` and the
 * app continues — the API client simply attaches no attestation token and the
 * server treats the caller as the lowest-trust `anonymous` subject
 * (fail-open for reads; threat-model T2).
 */
export async function initializeAppCheckClient(
  input: InitializeAppCheckInput,
): Promise<AppCheckInitResult> {
  const providerConfig = resolveAppCheckProviderConfig(input);
  const load = input.loadNative ?? loadNativeAppCheck;
  const native = load();

  if (!native) {
    return {
      initialized: false,
      reason:
        'native App Check module or Firebase config absent (expected until MOB-010 human gate clears)',
    };
  }

  try {
    const app = native.getApp();
    const provider = new native.ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      apple: { provider: providerConfig.apple },
      android: { provider: providerConfig.android },
    });
    appCheckInstance = await native.initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    loadedNative = native;
    return {
      initialized: true,
      debugProviderEnabled: providerConfig.debugProviderEnabled,
    };
  } catch (error) {
    appCheckInstance = null;
    loadedNative = null;
    return {
      initialized: false,
      reason: `App Check initialization failed: ${describeError(error)}`,
    };
  }
}

/**
 * Fetch a current App Check token, refreshing if needed. Returns `null` when
 * App Check is not initialized or the fetch fails — the caller must treat a
 * null token as "no attestation available" and proceed (fail-open for reads),
 * never as a hard error.
 *
 * NOTE (server reality, not a client guarantee): `@repo/security`'s quota
 * matrix currently hard-denies `expensive_read` (e.g. `/v1/search`) for
 * anonymous callers WITHOUT a verified token, even during an App Check
 * outage — this contradicts threat-model T2's fail-open-for-reads intent and
 * is tracked as a separate `@repo/security` owner decision (out of this
 * bead's scope). So a null token here does NOT guarantee search still
 * succeeds; the client must surface the server's `429 RATE_LIMITED`
 * honestly rather than assuming a fail-open it cannot rely on today.
 */
export async function getAppCheckToken(
  forceRefresh = false,
): Promise<string | null> {
  if (!appCheckInstance || !loadedNative) {
    return null;
  }
  try {
    const result = await loadedNative.getToken(
      appCheckInstance as Parameters<typeof loadedNative.getToken>[0],
      forceRefresh,
    );
    return result?.token ?? null;
  } catch {
    return null;
  }
}

/** Reset module state — test-only seam. */
export function __resetAppCheckForTests(): void {
  appCheckInstance = null;
  loadedNative = null;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
