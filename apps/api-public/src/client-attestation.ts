/** Client-version header policy for direct API callers. Rate limits remain server-side. */
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
