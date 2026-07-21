/**
 * Search API request-integrity guard.
 *
 * Same-origin CSRF/request-integrity control for progressive-enhancement search
 * endpoints. Replaces the former Firebase App Check guard.
 */
import {
  createRequestIntegrityGuard,
  type RequestIntegrityGuard,
  type RequestIntegrityMode,
  type RequestIntegrityTelemetry,
} from '../../../lib/request-integrity/server';

export type SearchRequestIntegrityOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: RequestIntegrityMode;
  readonly telemetry?: RequestIntegrityTelemetry;
};

export type SearchRequestIntegrityGuard = RequestIntegrityGuard;

export function createSearchRequestIntegrityGuard(
  options: SearchRequestIntegrityOptions = {},
): SearchRequestIntegrityGuard {
  return createRequestIntegrityGuard({
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.telemetry ? { telemetry: options.telemetry } : {}),
  });
}
