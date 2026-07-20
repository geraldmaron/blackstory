/**
 * Resolves `HandlerDeps.appCheckAvailability` (repo-uqmm) from a manual operator kill-switch
 * environment flag — the operator-flag half of the two wiring options `handlers.ts`/`README.md`
 * document (the other being an automatic verifier-failure circuit breaker, tracked separately as
 * `repo-vdnm` in `@repo/firebase`'s scope, not implemented here). Setting `APP_CHECK_OUTAGE_OVERRIDE`
 * is a deliberate, SYSTEMIC operator action (e.g. a Cloud Run env var flip during a confirmed
 * App Check provider outage) — it must never be derived from any single request's missing/invalid
 * token, which `handlers.ts` already keeps structurally impossible by only ever reading this from
 * the environment, never from a request.
 */
import type { AppCheckAvailability } from '@repo/security';

export const APP_CHECK_OUTAGE_OVERRIDE_ENV = 'APP_CHECK_OUTAGE_OVERRIDE' as const;

export type ResolveAppCheckAvailabilityOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

/** Reads the current operator override. Defaults to `'available'` — normal operation, zero
 * behavior change — unless the flag is explicitly set to a truthy/`'outage'` value. */
export function resolveAppCheckAvailability(
  options: ResolveAppCheckAvailabilityOptions = {},
): AppCheckAvailability {
  const environment = options.environment ?? process.env;
  const raw = environment[APP_CHECK_OUTAGE_OVERRIDE_ENV]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'outage' ? 'outage' : 'available';
}

/** Builds the `() => AppCheckAvailability` provider `HandlerDeps.appCheckAvailability` expects,
 * sampling the environment fresh on every call so an operator's flag flip takes effect on the next
 * request without a restart. */
export function createAppCheckAvailabilityProvider(
  options: ResolveAppCheckAvailabilityOptions = {},
): () => AppCheckAvailability {
  return () => resolveAppCheckAvailability(options);
}
