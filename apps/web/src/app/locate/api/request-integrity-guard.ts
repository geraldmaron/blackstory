/**
 * Locate API request-integrity guard.
 *
 * Same-origin CSRF/request-integrity control for geocode/locate reads used by the
 * public map and location flows. Replaces the former Firebase App Check guard.
 */
import {
  createRequestIntegrityGuard,
  type RequestIntegrityGuard,
  type RequestIntegrityMode,
  type RequestIntegrityTelemetry,
} from '../../../lib/request-integrity/server';

export type LocateRequestIntegrityOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: RequestIntegrityMode;
  readonly telemetry?: RequestIntegrityTelemetry;
};

export type LocateRequestIntegrityGuard = RequestIntegrityGuard;

export function createLocateRequestIntegrityGuard(
  options: LocateRequestIntegrityOptions = {},
): LocateRequestIntegrityGuard {
  return createRequestIntegrityGuard({
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.telemetry ? { telemetry: options.telemetry } : {}),
  });
}
