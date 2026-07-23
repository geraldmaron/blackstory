/**
 * EAS Update / OTA posture (MOB-019, repo-ovn7; ADR-023 §2/§7, threat-model
 * T6). Pure functions only — no native I/O, no `expo-constants` /
 * `expo-updates` calls — so they are deterministically unit-testable. The
 * runtime wiring that gathers real inputs (`expo-updates`'s
 * `isEnabled`/`channel`/`runtimeVersion`/`updateId`) lives in
 * `native-bridge.ts`; this module only decides what those values MEAN.
 *
 * Mirrors the `resolveObservabilityConfig` / `resolveAppCheckProviderConfig`
 * split already used in `src/observability/config.ts` and
 * `src/security/app-check.ts`: a pure resolver plus a defensive native
 * loader, kept in separate files so the decision logic is testable without
 * mocking native modules.
 */

/**
 * The accepted-risk code-signing posture (ADR-023 amendment #1,
 * threat-model T6). This is fixed by the ADR, not read from any runtime
 * input — it exists so observability/support tooling can attach a stable,
 * privacy-safe label to any OTA-related report without re-deriving the
 * decision from prose each time.
 */
export const CODE_SIGNING_POSTURE = 'free-tier-accepted-risk' as const;

export interface UpdatesPosture {
  /**
   * Whether the native updater is active for this binary. `app.config.ts`
   * always embeds `updates.url` + `extra.eas.projectId` (EAS CLI / project
   * link), but sets `updates.enabled: false` for APP_VARIANT=development so
   * local Dev Client + Metro own the JS bundle. Preview/production enable
   * ON_LOAD checks against the profile channel.
   */
  readonly enabled: boolean;
  /** `eas.json` build-profile channel this binary was published under, or `null` pre-gate. */
  readonly channel: string | null;
  /** EAS Update runtime version (ADR-023 §2 compatibility fence), or `null` pre-gate. */
  readonly runtimeVersion: string | null;
  /** Immutable OTA bundle id currently running, or `null` on the embedded/store bundle. */
  readonly updateId: string | null;
  /** Fixed accepted-risk label — see `CODE_SIGNING_POSTURE`. */
  readonly codeSigningPosture: typeof CODE_SIGNING_POSTURE;
}

export interface ResolveUpdatesPostureInput {
  readonly isEnabled: boolean;
  readonly channel: string | null;
  readonly runtimeVersion: string | null;
  readonly updateId: string | null;
}

/**
 * Resolve the current OTA posture from whatever `native-bridge.ts` loaded
 * (or `null` if the native module wasn't available). Never throws; a
 * missing/absent native surface resolves to the same "disabled" shape as a
 * real build that simply has no update server configured yet — both are the
 * expected pre-EAS-project state, not an error.
 */
export function resolveUpdatesPosture(native: ResolveUpdatesPostureInput | null): UpdatesPosture {
  if (!native) {
    return {
      enabled: false,
      channel: null,
      runtimeVersion: null,
      updateId: null,
      codeSigningPosture: CODE_SIGNING_POSTURE,
    };
  }
  return {
    enabled: native.isEnabled,
    channel: native.channel,
    runtimeVersion: native.runtimeVersion,
    updateId: native.updateId,
    codeSigningPosture: CODE_SIGNING_POSTURE,
  };
}

/**
 * Flat string map for attaching to a crash/perf report context
 * (`src/observability/report-context.ts`'s `reportContextToAttributes`
 * pattern) without carrying any privacy-invariant-7 field — these are build
 * identifiers, not user data.
 */
export function updatesPostureToAttributes(posture: UpdatesPosture): Record<string, string> {
  return {
    otaEnabled: String(posture.enabled),
    otaChannel: posture.channel ?? 'unknown',
    otaRuntimeVersion: posture.runtimeVersion ?? 'unknown',
    otaUpdateId: posture.updateId ?? 'embedded',
    otaCodeSigningPosture: posture.codeSigningPosture,
  };
}
