/**
 * Corrections-route request-integrity guard.
 *
 * Same-origin CSRF/request-integrity control for correction, appeal, and abuse POSTs.
 * Replaces the former Firebase App Check guard on these mutation surfaces.
 */
import {
  createRequestIntegrityGuard,
  type RequestIntegrityGuard,
  type RequestIntegrityMode,
  type RequestIntegrityTelemetry,
} from '../../lib/request-integrity/server';

export type CorrectionRequestIntegrityOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: RequestIntegrityMode;
  readonly telemetry?: RequestIntegrityTelemetry;
};

export type CorrectionRequestIntegrityGuard = RequestIntegrityGuard;

export function createCorrectionRequestIntegrityGuard(
  options: CorrectionRequestIntegrityOptions = {},
): CorrectionRequestIntegrityGuard {
  return createRequestIntegrityGuard({
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.telemetry ? { telemetry: options.telemetry } : {}),
  });
}
