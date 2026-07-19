/**
 * Runtime wiring that binds the pure observability modules to the real Expo
 * config, device platform, and data layer (MOB-018). Kept separate from the
 * pure/testable modules (`report-context.ts`, `config.ts`, `crash-reporter.ts`)
 * so those stay free of `expo-constants` / `react-native` globals — the same
 * split `src/security/bootstrap.ts` uses for App Check.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { cacheDiagnostics, type CacheStore, type Connectivity } from '../data';
import { resolveObservabilityConfig } from './config';
import {
  setActiveReportContext,
  setObservabilityConfig,
} from './crash-reporter';
import { loadNativeCrashlytics, loadNativePerf } from './native-bridge';
import { buildReportContext, resolveRuntimeVersion, type ReportContext } from './report-context';

function resolveBuildNumber(): string | undefined {
  const ios = Constants.expoConfig?.ios?.buildNumber;
  const android = Constants.expoConfig?.android?.versionCode;
  if (typeof ios === 'string' && ios.length > 0) {
    return ios;
  }
  if (typeof android === 'number') {
    return String(android);
  }
  return undefined;
}

function resolveAppVariant(): string | undefined {
  const variant = Constants.expoConfig?.extra?.appVariant;
  return typeof variant === 'string' ? variant : undefined;
}

/**
 * Gather the real inputs (Constants, on-device cache diagnostics,
 * connectivity) and assemble the report context. Async because release-id /
 * schema-version currently live in the SQLite cache's meta table
 * (`data/diagnostics.ts` `cacheDiagnostics`) — MOB-009's cache is the
 * closest thing to a "release-stamp bootstrap" record on-device today.
 */
export async function resolveReportContext(
  store: CacheStore,
  connectivity: Connectivity,
): Promise<ReportContext> {
  const diagnostics = await cacheDiagnostics(store);
  const appVersion = Constants.expoConfig?.version;

  return buildReportContext({
    appVersion,
    buildNumber: resolveBuildNumber(),
    runtimeVersion: resolveRuntimeVersion(Constants.expoConfig?.runtimeVersion, appVersion),
    releaseId: diagnostics.releaseId,
    schemaVersion: diagnostics.schemaVersion,
    platform: Platform.OS,
    platformVersion: Platform.Version === undefined ? undefined : String(Platform.Version),
    appVariant: resolveAppVariant(),
    // Degraded = not currently online. This is the coarse, honest signal
    // (threat-model T7): it does not imply *which* cached rows are stale,
    // only that reads may currently be served from cache.
    degraded: !connectivity.isOnline(),
  });
}

export interface ObservabilityInitResult {
  readonly initialized: boolean;
  readonly observabilityEnabled: boolean;
}

/**
 * Initialize observability for this build. NEVER throws (same contract as
 * `bootstrapAppCheck` in `src/security/bootstrap.ts`): a missing/misconfigured
 * native SDK degrades to `{ initialized: false }` and the app continues
 * normally. Call once on app start alongside `bootstrapAppCheck` (MOB-008
 * owns the actual entry-point wiring; not touched by this bead).
 */
export async function initializeObservability(
  store: CacheStore,
  connectivity: Connectivity,
): Promise<ObservabilityInitResult> {
  try {
    const config = resolveObservabilityConfig(Constants.expoConfig?.extra);
    setObservabilityConfig(config);

    const context = await resolveReportContext(store, connectivity);
    setActiveReportContext(context);

    const crashlytics = loadNativeCrashlytics();
    if (crashlytics) {
      try {
        await crashlytics.setCrashlyticsCollectionEnabled(config.observabilityEnabled);
      } catch {
        // Toggling collection failing must not block startup.
      }
    }

    const perf = loadNativePerf();
    if (perf) {
      try {
        await perf.setPerformanceCollectionEnabled(config.observabilityEnabled);
      } catch {
        // Same as above.
      }
    }

    return {
      initialized: Boolean(crashlytics || perf),
      observabilityEnabled: config.observabilityEnabled,
    };
  } catch {
    return { initialized: false, observabilityEnabled: false };
  }
}

/**
 * Re-resolve just the report context (e.g. after a release-stamp sync or a
 * connectivity transition) without re-toggling SDK collection state.
 */
export async function refreshReportContext(
  store: CacheStore,
  connectivity: Connectivity,
): Promise<void> {
  try {
    const context = await resolveReportContext(store, connectivity);
    setActiveReportContext(context);
  } catch {
    // Best-effort refresh — never block the caller.
  }
}
