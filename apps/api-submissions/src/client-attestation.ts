/**
 * Client attestation boundary for `apps/api-submissions` — replaces Firebase App Check
 * after the Postgres cutover (ADR-020). Mobile corrections declare platform + API major via
 * `X-BlackStory-Client`; rate limits treat that as the abuse-trust signal for mutations.
 */
import {
  createClientAttestationGuard,
  type ClientAttestationHeaders,
  type ClientAttestationMode,
  type ClientAttestationTelemetry,
} from '@repo/security';

export type SubmissionsApiClientAttestationOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: ClientAttestationMode;
  readonly telemetry?: ClientAttestationTelemetry;
};

const consoleTelemetry: ClientAttestationTelemetry = {
  record(event) {
    console.info(JSON.stringify(event));
  },
};

export function createSubmissionsApiClientAttestationGuard(
  options: SubmissionsApiClientAttestationOptions = {},
) {
  const guard = createClientAttestationGuard({
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    telemetry: options.telemetry ?? consoleTelemetry,
  });
  return (request: { readonly headers: ClientAttestationHeaders }) =>
    guard({ headers: request.headers });
}

export type { ClientAttestationDecision as SubmissionsApiClientAttestationDecision } from '@repo/security';
