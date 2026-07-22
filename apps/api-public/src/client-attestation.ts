/**
 * Client attestation boundary for `apps/api-public` — replaces Firebase App Check
 * after the Postgres cutover (ADR-020). Mobile and other direct callers declare
 * platform + API major via `X-BlackStory-Client`; rate limits treat that as the
 * abuse-trust signal for expensive reads.
 */
import {
  createClientAttestationGuard,
  type ClientAttestationHeaders,
  type ClientAttestationMode,
  type ClientAttestationTelemetry,
} from '@repo/security';

export type PublicApiClientAttestationOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: ClientAttestationMode;
  readonly telemetry?: ClientAttestationTelemetry;
};

const consoleTelemetry: ClientAttestationTelemetry = {
  record(event) {
    console.info(JSON.stringify(event));
  },
};

export function createPublicApiClientAttestationGuard(
  options: PublicApiClientAttestationOptions = {},
) {
  const guard = createClientAttestationGuard({
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    telemetry: options.telemetry ?? consoleTelemetry,
  });
  return (request: { readonly headers: ClientAttestationHeaders }) =>
    guard({ headers: request.headers });
}

export type { ClientAttestationDecision as PublicApiClientAttestationDecision } from '@repo/security';
