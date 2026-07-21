/**
 * Submit-route request-integrity guard.
 *
 * Thin wrapper around the shared same-origin CSRF/request-integrity control used by
 * anonymous public mutation surfaces. Replaces the former Firebase App Check guard on
 * this route without changing rate-limit or quarantine behavior.
 */
import {
  createRequestIntegrityGuard,
  type RequestIntegrityGuard,
  type RequestIntegrityMode,
  type RequestIntegrityTelemetry,
} from '../../lib/request-integrity/server';

export type SubmitLeadRequestIntegrityOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: RequestIntegrityMode;
  readonly telemetry?: RequestIntegrityTelemetry;
};

export type SubmitLeadRequestIntegrityGuard = RequestIntegrityGuard;

export function createSubmitLeadRequestIntegrityGuard(
  options: SubmitLeadRequestIntegrityOptions = {},
): SubmitLeadRequestIntegrityGuard {
  return createRequestIntegrityGuard({
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.telemetry ? { telemetry: options.telemetry } : {}),
  });
}
