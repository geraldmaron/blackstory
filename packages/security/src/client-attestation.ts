/**
 * Client attestation for direct API callers (mobile, future native surfaces).
 *
 * Replaces Firebase App Check for the public read/submissions boundary: a well-formed
 * `X-BlackStory-Client` header proves the caller is an honest shipped client declaring
 * its platform and API major. Abuse control remains rate limits + guardrails — this is
 * not authorization.
 */
export const CLIENT_VERSION_HEADER = 'x-blackstory-client';

export type ClientAttestationMode = 'monitor' | 'enforce';

export type ClientAttestationReason = 'missing_header' | 'malformed_header';

export type ClientAttestationDecision =
  | { readonly allowed: true; readonly verified: boolean; readonly mode: ClientAttestationMode }
  | {
      readonly allowed: false;
      readonly verified: false;
      readonly mode: 'enforce';
      readonly status: 401;
      readonly reason: ClientAttestationReason;
    };

export type ClientAttestationTelemetryEvent = {
  readonly control: 'client_attestation';
  readonly mode: ClientAttestationMode;
  readonly outcome: 'verified' | 'monitored_failure' | 'denied';
  readonly reason?: ClientAttestationReason;
};

export type ClientAttestationTelemetry = {
  record(event: ClientAttestationTelemetryEvent): void;
};

export type ClientAttestationHeaders = Headers | Readonly<Record<string, string | undefined>>;

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

/** Parses `X-BlackStory-Client: <platform>/<semver>; api=<n>`. Returns undefined when absent/malformed. */
export function parseClientVersionHeader(headerValue: string | undefined): string | undefined {
  if (!headerValue?.trim()) return undefined;
  const apiMatch = /(?:^|;|\s)api=(\d{1,5})\b/i.exec(headerValue);
  if (apiMatch?.[1]) return `v${apiMatch[1]}`;
  return undefined;
}

export function parseClientAttestationMode(
  value: string | undefined,
  environment: EnvironmentLike = process.env,
): ClientAttestationMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'monitor' || normalized === 'enforce') return normalized;
  return environment.NODE_ENV === 'production' ? 'enforce' : 'monitor';
}

function headerValue(headers: ClientAttestationHeaders, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value ?? null;
  }
  return null;
}

function failureReason(headers: ClientAttestationHeaders): ClientAttestationReason | undefined {
  const raw = headerValue(headers, CLIENT_VERSION_HEADER);
  if (!raw?.trim()) return 'missing_header';
  if (!parseClientVersionHeader(raw)) return 'malformed_header';
  return undefined;
}

export function createClientAttestationGuard(
  options: {
    readonly environment?: EnvironmentLike;
    readonly mode?: ClientAttestationMode;
    readonly telemetry?: ClientAttestationTelemetry;
  } = {},
): (request: { readonly headers: ClientAttestationHeaders }) => Promise<ClientAttestationDecision> {
  const environment = options.environment ?? process.env;
  const mode =
    options.mode ??
    parseClientAttestationMode(environment.CLIENT_ATTESTATION_MODE, environment);
  const telemetry = options.telemetry ?? {
    record(event: ClientAttestationTelemetryEvent) {
      console.info(JSON.stringify(event));
    },
  };

  return async ({ headers }) => {
    const reason = failureReason(headers);
    if (!reason) {
      telemetry.record({ control: 'client_attestation', mode, outcome: 'verified' });
      return { allowed: true, verified: true, mode };
    }
    if (mode === 'monitor') {
      telemetry.record({ control: 'client_attestation', mode, outcome: 'monitored_failure', reason });
      return { allowed: true, verified: false, mode };
    }
    telemetry.record({ control: 'client_attestation', mode, outcome: 'denied', reason });
    return {
      allowed: false,
      verified: false,
      mode: 'enforce',
      status: 401,
      reason,
    };
  };
}

/** True when the request carries a parseable client version header (rate-limit trust signal). */
export function isClientAttested(headers: ClientAttestationHeaders): boolean {
  const raw = headerValue(headers, CLIENT_VERSION_HEADER);
  return Boolean(raw && parseClientVersionHeader(raw));
}
