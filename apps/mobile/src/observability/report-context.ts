/**
 * Release/build metadata tagging (MOB-018).
 *
 * Every crash and performance report must carry the same identifying
 * metadata so an incident can be traced to an exact build, release, and
 * runtime state — without ever carrying any of the privacy-invariant-7
 * categories (query text, correction content, precise location, citation
 * URLs, sensitive classifications). None of the fields here are in those
 * categories: they are build/version identifiers and a coarse connectivity
 * flag, not user data.
 *
 * `buildReportContext` is a PURE function (no `expo-constants` / native I/O)
 * so it is deterministically unit-testable; `bootstrap.ts` owns the runtime
 * wiring that gathers the real inputs (Constants, cache diagnostics,
 * connectivity) and calls this function. This mirrors the
 * `resolveAppCheckProviderConfig` / `initializeAppCheckClient` split already
 * used in `src/security/app-check.ts`.
 */

const UNKNOWN = 'unknown';

/** Fields attached to every crash/perf report (MOB-018 item 3). */
export interface ReportContext {
  /** User-facing semantic app version (`Constants.expoConfig.version`). */
  readonly appVersion: string;
  /** Store build number / version code (CI-derived, ADR-023 §3). */
  readonly buildNumber: string;
  /**
   * EAS Update runtime version (ADR-023 §2): bumped only when the native
   * layer changes, so it tells us whether an OTA-shipped JS bundle matches
   * the binary it is running on. See `resolveRuntimeVersion` for the
   * resolution/fallback rule.
   */
  readonly runtimeVersion: string;
  /**
   * The server release stamp this client last synced against (MOB-005
   * bootstrap / `data/release-cache.ts` `getActiveStamp`; ADR-022 §4). This
   * is a release identifier, never a content field — safe to log.
   */
  readonly releaseId: string;
  /** Local SQLite cache schema version (`data/db/schema.ts` `CACHE_SCHEMA_VERSION`). */
  readonly schemaVersion: number;
  /** `Platform.OS` — `'ios' | 'android' | 'web'`. */
  readonly platform: string;
  /** OS version string/number, where available. */
  readonly platformVersion: string;
  /** `development | preview | production` (mobile-identity.md environment tiers). */
  readonly appVariant: string;
  /**
   * Current degraded-mode state (MOB-009 `data/offline.ts` connectivity +
   * `data/release-cache.ts` `FreshnessSignal.degraded`). `true` means the
   * app is currently serving cached/offline data — essential context for
   * interpreting a crash or a slow trace.
   */
  readonly degraded: boolean;
}

export interface BuildReportContextInput {
  readonly appVersion?: string;
  readonly buildNumber?: string;
  readonly runtimeVersion?: string;
  readonly releaseId?: string;
  readonly schemaVersion: number;
  readonly platform?: string;
  readonly platformVersion?: string | number;
  readonly appVariant?: string;
  readonly degraded: boolean;
}

/**
 * Assemble the centralized report-context object. Missing/unresolvable
 * fields fall back to a stable `"unknown"` placeholder rather than throwing
 * or omitting the key — every report has the SAME shape, so a dashboard can
 * always group by these fields even when one input was unavailable (e.g.
 * before bootstrap has resolved the release stamp).
 */
export function buildReportContext(input: BuildReportContextInput): ReportContext {
  return {
    appVersion: nonEmpty(input.appVersion) ?? UNKNOWN,
    buildNumber: nonEmpty(input.buildNumber) ?? UNKNOWN,
    runtimeVersion: nonEmpty(input.runtimeVersion) ?? UNKNOWN,
    releaseId: nonEmpty(input.releaseId) ?? UNKNOWN,
    schemaVersion: Number.isFinite(input.schemaVersion) ? input.schemaVersion : -1,
    platform: nonEmpty(input.platform) ?? UNKNOWN,
    platformVersion:
      input.platformVersion === undefined || input.platformVersion === null
        ? UNKNOWN
        : String(input.platformVersion),
    appVariant: nonEmpty(input.appVariant) ?? 'development',
    degraded: input.degraded,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Shape of `Constants.expoConfig?.runtimeVersion` in an Expo config: either a
 * literal string (an explicit pin) or a policy object (e.g.
 * `{ policy: 'appVersion' }`) that Expo/EAS Update resolves to a concrete
 * string at build/update time. `expo-updates` (not a dependency of this app
 * yet — see observability/README.md "Known gap") is what resolves the policy
 * to its final string at runtime via `Updates.runtimeVersion`; until that
 * package is adopted (tracked as a follow-up, not invented here) we fall
 * back to the app version, which is a reasonable proxy since this app has no
 * native-only OTA-incompatible surface yet.
 */
export function resolveRuntimeVersion(
  configRuntimeVersion: unknown,
  appVersionFallback: string | undefined,
): string | undefined {
  if (typeof configRuntimeVersion === 'string' && configRuntimeVersion.length > 0) {
    return configRuntimeVersion;
  }
  return appVersionFallback;
}

/** Convert a report context into a flat string->string attribute map, the
 * shape Crashlytics `setAttributes` / Performance `putAttribute` require. */
export function reportContextToAttributes(context: ReportContext): Record<string, string> {
  return {
    appVersion: context.appVersion,
    buildNumber: context.buildNumber,
    runtimeVersion: context.runtimeVersion,
    releaseId: context.releaseId,
    schemaVersion: String(context.schemaVersion),
    platform: context.platform,
    platformVersion: context.platformVersion,
    appVariant: context.appVariant,
    degraded: String(context.degraded),
  };
}
