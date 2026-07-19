/**
 * App Check enforcement staging (MOB-010; ADR-020 §3 "Monitor → enforce
 * rollout").
 *
 * App Check is rolled out in STAGES, never flipped straight to hard
 * enforcement:
 *
 *   1. MONITOR (default): the client ships attestation and attaches tokens,
 *      but the server treats App Check as a pure observed signal
 *      (`missing_app_check` risk input) — no request is denied for a
 *      failed/absent token. MOB-018 dashboards watch the genuine-client
 *      verified-attestation rate across the real device/OS fleet.
 *
 *   2. ENFORCE: promote an endpoint class to enforcement (deny/tighten on
 *      threshold) ONLY once monitor metrics prove the false-negative rate on
 *      genuine clients is negligible, so enforcement cannot lock out honest
 *      users on a provider quirk. Even under enforcement, reads fail open to
 *      rate-limited `anonymous` access during an App Check *outage*
 *      (threat-model T2; ADR-010 degraded-read doctrine).
 *
 * This value is CLIENT-SIDE advisory only. The authoritative enforcement
 * decision lives server-side in `apps/api-public` + `@repo/security`; the
 * client cannot self-grant enforcement. The mode here drives client
 * observability/UX (e.g. whether to surface attestation failures) and is a
 * deliberate, documented cutover — it defaults to `monitor` and is NEVER
 * hardcoded to `enforce`.
 *
 * The cutover runbook lives in `src/security/README.md`.
 */

export type AppCheckEnforcementMode = 'monitor' | 'enforce';

/**
 * The default enforcement stage. Deliberately `monitor` — do NOT change this
 * default to `enforce`. Promotion is an explicit operational cutover recorded
 * in the runbook, gated on MOB-018 monitor evidence, not a code default.
 */
export const DEFAULT_APP_CHECK_ENFORCEMENT_MODE: AppCheckEnforcementMode =
  'monitor';

/**
 * Resolve the enforcement mode from a config value (e.g.
 * `Constants.expoConfig.extra.appCheckEnforcementMode`). Anything other than
 * the explicit string `'enforce'` resolves to `monitor` — enforcement must be
 * opted into deliberately and can never be reached by a typo or a missing
 * value.
 */
export function resolveEnforcementMode(
  configValue: unknown,
): AppCheckEnforcementMode {
  return configValue === 'enforce' ? 'enforce' : DEFAULT_APP_CHECK_ENFORCEMENT_MODE;
}
