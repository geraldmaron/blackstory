/**
 * Runtime wiring that binds the pure observability modules to the real Expo
 * config, device platform, and data layer (MOB-018). Kept separate from the
 * pure/testable modules (`report-context.ts`, `config.ts`, `crash-reporter.ts`)
 * so those stay free of `expo-constants` / `react-native` globals — the same
 * split `src/security/bootstrap.ts` uses for client attestation.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { cacheDiagnostics, type CacheStore, type Connectivity } from '../data';
import { resolveObservabilityConfig } from './config';
import {
  setActiveReportContext,
  setObservabilityConfig,
} from './crash-reporter';
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
    degraded: !connectivity.isOnline(),
  });
}

export interface ObservabilityInitResult {
  readonly initialized: boolean;
  readonly observabilityEnabled: boolean;
}

/**
 * Initialize observability for this build. NEVER throws: resolves config and
 * report context, then activates the dev-console reporter when enabled.
 * Call once on app start (MOB-008 owns the actual entry-point wiring).
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

    return {
      initialized: true,
      observabilityEnabled: config.observabilityEnabled,
    };
  } catch {
    return { initialized: false, observabilityEnabled: false };
  }
}

/**
 * Re-resolve just the report context (e.g. after a release-stamp sync or a
 * connectivity transition) without re-toggling observability config.
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
