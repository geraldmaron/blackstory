/**
 * Same-origin request-integrity guard for anonymous public APIs.
 *
 * A server-minted random token is returned to same-origin JavaScript and mirrored in an
 * HttpOnly, SameSite=Strict cookie. Protected requests must present both values. This provides
 * fail-closed CSRF/request-origin protection without a Firebase runtime dependency; endpoint
 * rate limits remain the separate abuse-control layer.
 */
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, validateCsrfToken } from '../web-security/csrf';

export type RequestIntegrityMode = 'monitor' | 'enforce';
export type RequestIntegrityHeaders = Headers | Readonly<Record<string, string | undefined>>;
export type RequestIntegrityReason =
  | 'missing_token'
  | 'token_mismatch'
  | 'cross_site_request';

export type RequestIntegrityDecision =
  | { readonly allowed: true; readonly verified: boolean; readonly mode: RequestIntegrityMode }
  | {
      readonly allowed: false;
      readonly verified: false;
      readonly mode: 'enforce';
      readonly status: 401 | 403;
      readonly reason: RequestIntegrityReason;
    };

export type RequestIntegrityTelemetryEvent = {
  readonly control: 'request_integrity';
  readonly mode: RequestIntegrityMode;
  readonly outcome: 'verified' | 'monitored_failure' | 'denied';
  readonly reason?: RequestIntegrityReason;
};

export type RequestIntegrityTelemetry = {
  record(event: RequestIntegrityTelemetryEvent): void;
};

export type RequestIntegrityGuard = (request: {
  readonly headers: RequestIntegrityHeaders;
}) => Promise<RequestIntegrityDecision>;

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

function headerValue(headers: RequestIntegrityHeaders, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value ?? null;
  }
  return null;
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const encoded = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
  return null;
}

export function parseRequestIntegrityMode(
  value: string | undefined,
  environment: EnvironmentLike = process.env,
): RequestIntegrityMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'monitor' || normalized === 'enforce') return normalized;
  return environment.NODE_ENV === 'production' ? 'enforce' : 'monitor';
}

function failureReason(headers: RequestIntegrityHeaders): RequestIntegrityReason | undefined {
  const fetchSite = headerValue(headers, 'sec-fetch-site')?.toLowerCase();
  if (fetchSite === 'cross-site') return 'cross_site_request';

  const cookieToken = cookieValue(headerValue(headers, 'cookie'), CSRF_COOKIE_NAME);
  const headerToken = headerValue(headers, CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken) return 'missing_token';
  if (!validateCsrfToken({ cookieToken, headerToken })) return 'token_mismatch';
  return undefined;
}

export function createRequestIntegrityGuard(
  options: {
    readonly environment?: EnvironmentLike;
    readonly mode?: RequestIntegrityMode;
    readonly telemetry?: RequestIntegrityTelemetry;
  } = {},
): RequestIntegrityGuard {
  const environment = options.environment ?? process.env;
  const mode = options.mode ?? parseRequestIntegrityMode(environment.REQUEST_INTEGRITY_MODE, environment);
  const telemetry = options.telemetry ?? {
    record(event: RequestIntegrityTelemetryEvent) {
      console.info(JSON.stringify(event));
    },
  };

  return async ({ headers }) => {
    const reason = failureReason(headers);
    if (!reason) {
      telemetry.record({ control: 'request_integrity', mode, outcome: 'verified' });
      return { allowed: true, verified: true, mode };
    }
    if (mode === 'monitor') {
      telemetry.record({ control: 'request_integrity', mode, outcome: 'monitored_failure', reason });
      return { allowed: true, verified: false, mode };
    }
    telemetry.record({ control: 'request_integrity', mode, outcome: 'denied', reason });
    return {
      allowed: false,
      verified: false,
      mode: 'enforce',
      status: reason === 'cross_site_request' ? 403 : 401,
      reason,
    };
  };
}
