/**
 * Defensive native-module loaders for Crashlytics / Performance Monitoring
 * (MOB-018).
 *
 * Mirrors `src/security/app-check.ts`'s `loadNativeAppCheck`: a `require`
 * (not a static import, so the load is lazy and catchable) wrapped in a
 * try/catch that returns `null` — never throws — when the native module or
 * its native backing is absent. That is the EXPECTED state today: no real
 * Firebase iOS/Android app is registered yet and no
 * `GoogleService-Info.plist` / `google-services.json` is committed (same
 * human gate `app-check.ts` documents), and it will also be the expected
 * state in this sandbox/CI environment where the native RN Firebase modules
 * are not installed at all (bead requirement 5: "graceful SDK failure").
 */

/** Minimal Crashlytics surface this app consumes. */
export interface NativeCrashlyticsSurface {
  recordError(error: Error): void;
  log(message: string): void;
  setAttributes(attributes: Record<string, string>): Promise<void>;
  setCrashlyticsCollectionEnabled(enabled: boolean): Promise<void>;
}

/** Minimal Performance Monitoring surface this app consumes. */
export interface NativePerfTrace {
  start(): Promise<void>;
  stop(): Promise<void>;
  putAttribute(key: string, value: string): void;
}

export interface NativePerfSurface {
  newTrace(name: string): NativePerfTrace;
  setPerformanceCollectionEnabled(enabled: boolean): Promise<void>;
}

/**
 * Load `@react-native-firebase/crashlytics` defensively. Returns `null`
 * (never throws) when the package is not installed, has no native backing,
 * or does not expose the expected shape.
 */
export function loadNativeCrashlytics(): NativeCrashlyticsSurface | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/crashlytics') as {
      default?: () => NativeCrashlyticsSurface;
    } & (() => NativeCrashlyticsSurface);
    const factory = typeof mod?.default === 'function' ? mod.default : mod;
    if (typeof factory !== 'function') {
      return null;
    }
    const instance = factory();
    if (!instance || typeof instance.recordError !== 'function') {
      return null;
    }
    return instance;
  } catch {
    return null;
  }
}

/**
 * Load `@react-native-firebase/perf` defensively. Same never-throws
 * contract as `loadNativeCrashlytics`.
 */
export function loadNativePerf(): NativePerfSurface | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/perf') as {
      default?: () => NativePerfSurface;
    } & (() => NativePerfSurface);
    const factory = typeof mod?.default === 'function' ? mod.default : mod;
    if (typeof factory !== 'function') {
      return null;
    }
    const instance = factory();
    if (!instance || typeof instance.newTrace !== 'function') {
      return null;
    }
    return instance;
  } catch {
    return null;
  }
}
