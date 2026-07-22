/**
 * Resolves `HandlerDeps.appCheckAvailability` (repo-uqmm) from a manual operator kill-switch
 * environment flag and/or an automatic App Check verifier-failure circuit breaker (repo-vdnm).
 *
 * Manual `APP_CHECK_OUTAGE_OVERRIDE` is a deliberate, systemic operator action and always wins
 * when set. The circuit breaker complements it by detecting sustained verifier throws without
 * treating a lone missing/invalid token as an outage.
 */
import type { AppCheckCircuitBreaker } from '@repo/firebase';
import type { AppCheckAvailability } from '@repo/security';

export const APP_CHECK_OUTAGE_OVERRIDE_ENV = 'APP_CHECK_OUTAGE_OVERRIDE' as const;

export type ResolveAppCheckAvailabilityOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly circuitBreaker?: AppCheckCircuitBreaker;
};

function readManualOutageOverride(
  environment: Readonly<Record<string, string | undefined>>,
): AppCheckAvailability | undefined {
  const raw = environment[APP_CHECK_OUTAGE_OVERRIDE_ENV]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'outage' ? 'outage' : undefined;
}

/** Reads the current availability signal. Defaults to `'available'` when the breaker is closed
 * and no operator override is set. */
export function resolveAppCheckAvailability(
  options: ResolveAppCheckAvailabilityOptions = {},
): AppCheckAvailability {
  const environment = options.environment ?? process.env;
  const manualOverride = readManualOutageOverride(environment);
  if (manualOverride === 'outage') {
    return 'outage';
  }
  return options.circuitBreaker?.getAvailability() ?? 'available';
}

/** Builds the `() => AppCheckAvailability` provider `HandlerDeps.appCheckAvailability` expects,
 * sampling the environment and breaker fresh on every call. */
export function createAppCheckAvailabilityProvider(
  options: ResolveAppCheckAvailabilityOptions = {},
): () => AppCheckAvailability {
  return () => resolveAppCheckAvailability(options);
}
