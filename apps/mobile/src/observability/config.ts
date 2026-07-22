/**
 * Observability kill-switch and sampling configuration (MOB-018).
 *
 * Mirrors the repo's existing `operating-principle-runs-itself-within-reason`
 * posture (budget-capped, kill-switch, free-tier-first — see
 * `docs/mobile/decisions/mobile-identity.md` spend-ceiling gate,
 * `docs/mobile/security/threat-model.md` T9, and the server-side pattern in
 * `infra/gcp/cost-controls/cost-controls-matrix.json` /
 * `packages/security/src/resource-controls.ts`) rather than inventing a new
 * shape for mobile. Firebase Crashlytics and Performance Monitoring are BOTH
 * free-tier / not-metered-per-event in Firebase's actual pricing model
 * (unlike Firestore reads or a paid map API — see `README.md` "Cost
 * ceilings" for the full reasoning), so there is no daily-budget/soft-
 * shutdown automation to wire here the way `resource-controls.ts` does for
 * metered services. What this module DOES provide, consistent with that
 * posture:
 *
 *   - `observabilityEnabled` — a blunt kill switch (default ON, override-able
 *     per build/config), for the case Firebase's free-tier posture ever
 *     changes, a runaway crash loop floods the dashboard, or an operator
 *     simply wants it off.
 *   - `performanceSampleRate` — a documented sampling rate that bounds trace
 *     VOLUME/NOISE (not cost, since perf traces are unmetered), so dashboards
 *     stay legible under real traffic. See README.md "Sampling & retention".
 */

export interface ObservabilityConfig {
  readonly observabilityEnabled: boolean;
  /** Fraction of performance traces actually started, in `[0, 1]`. */
  readonly performanceSampleRate: number;
}

/** Default: observability ON. Crash reporting and perf monitoring are
 * diagnostic-only (no user-behavior analytics — see README.md item 4), so
 * there is no privacy reason to default this off; it exists so an operator
 * can turn it off, not so it ships off. */
export const DEFAULT_OBSERVABILITY_ENABLED = true;

/** Default performance-trace sample rate — see README.md "Sampling &
 * retention" for the rationale (10% bounds dashboard volume while still
 * giving a representative performance signal). */
export const DEFAULT_PERFORMANCE_SAMPLE_RATE = 0.1;

/**
 * Resolve the observability config from an arbitrary config value (e.g.
 * `Constants.expoConfig.extra`). Never throws: any malformed/missing input
 * resolves to the safe defaults above. Mirrors `resolveEnforcementMode`'s
 * "typo-safe, opt-in-required" pattern used elsewhere in mobile config
 * (observability must be explicitly disabled; here: disabling
 * observability must be explicit — `false`, not any other falsy value, turns
 * it off).
 */
export function resolveObservabilityConfig(extra: unknown): ObservabilityConfig {
  const record = isRecord(extra) ? extra : {};

  const enabledRaw = record.observabilityEnabled;
  const observabilityEnabled = enabledRaw === false ? false : DEFAULT_OBSERVABILITY_ENABLED;

  const sampleRaw = record.performanceSampleRate;
  const performanceSampleRate =
    typeof sampleRaw === 'number' && Number.isFinite(sampleRaw) && sampleRaw >= 0 && sampleRaw <= 1
      ? sampleRaw
      : DEFAULT_PERFORMANCE_SAMPLE_RATE;

  return { observabilityEnabled, performanceSampleRate };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Deterministic sampling decision. `random` is injectable so tests never
 * depend on `Math.random` (0 and 1 are treated as hard off/on so a
 * misconfigured rate can never accidentally sample nothing or everything by
 * a floating-point edge case).
 */
export function shouldSamplePerfTrace(
  rate: number,
  random: () => number = Math.random,
): boolean {
  if (!Number.isFinite(rate) || rate <= 0) {
    return false;
  }
  if (rate >= 1) {
    return true;
  }
  return random() < rate;
}
