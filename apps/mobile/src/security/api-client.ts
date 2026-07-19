/**
 * App Check token attachment layer (MOB-010).
 *
 * This is NOT the full typed API client (that is MOB-009). It is the thin
 * security wrapper that, on EVERY outgoing request to `apps/api-public`:
 *
 *   1. attempts to fetch/refresh an App Check token, and
 *   2. attaches it under the exact header the server reads —
 *      `X-Firebase-AppCheck` (see `@repo/firebase`'s `APP_CHECK_HEADER` /
 *      `readAppCheckToken`, consumed by `apps/api-public/src/http/handlers.ts`
 *      via `deps.appCheckGuard`), plus
 *   3. attaches the client version-floor header `X-BlackStory-Client:
 *      mobile/<version>; api=<major>` (ADR-021 §2 / handlers.ts
 *      `parseClientApiVersion`).
 *
 * Design invariants (adversarial cases, MOB-010):
 *   - Token attachment is attempted on EVERY request — never silently omitted.
 *     `getToken` is called once per request; the test asserts this.
 *   - FAIL-OPEN for the CLIENT: if no token is available (App Check not yet
 *     initialized, provider outage, human gate not cleared) the request is
 *     STILL sent, without the header. Attestation is a signal, not a gate
 *     (invariant 6). The client does not block itself.
 *   - The client makes NO fail-open GUARANTEE about the server response.
 *     `@repo/security` currently hard-denies `expensive_read` (`/v1/search`)
 *     for anonymous callers lacking a verified token even during an App Check
 *     outage (flagged in api-public/src/http/README.md, tracked as a separate
 *     `@repo/security` owner decision). So a healthy client MUST attest to use
 *     search; when it cannot, the server may return `429 RATE_LIMITED` and the
 *     wrapper surfaces that response verbatim rather than pretending reads
 *     always fail open.
 *   - No token is ever logged (invariant 7) — see log-redaction.ts.
 */

export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';
export const CLIENT_VERSION_HEADER = 'X-BlackStory-Client';

export type TokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

export interface ApiClientConfig {
  /** Base URL of `apps/api-public`, e.g. `https://api.blackbook.app`. */
  readonly baseUrl: string;
  /** App version string, e.g. `1.0.0` (from `Constants.expoConfig.version`). */
  readonly clientVersion: string;
  /** API major version this build targets (the `/vN` prefix), e.g. `1`. */
  readonly apiMajor: number;
  /** Fetch an App Check token (defaults are supplied by the factory). */
  readonly getToken: TokenProvider;
  /** Injected fetch (defaults to global `fetch`). */
  readonly fetch?: typeof fetch;
}

export interface ApiRequestOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: BodyInit | null;
  /** Force an App Check token refresh for this request. */
  readonly forceRefreshToken?: boolean;
  readonly signal?: AbortSignal;
}

export interface ApiClient {
  request(path: string, options?: ApiRequestOptions): Promise<Response>;
}

function buildClientVersionHeader(version: string, apiMajor: number): string {
  return `mobile/${version}; api=${apiMajor}`;
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Create the App Check-attaching API client wrapper.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const doFetch = config.fetch ?? globalThis.fetch;
  const clientHeader = buildClientVersionHeader(
    config.clientVersion,
    config.apiMajor,
  );

  return {
    async request(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<Response> {
      // Attempt token fetch on EVERY request — never conditionally skipped.
      const token = await config.getToken(options.forceRefreshToken ?? false);

      const headers: Record<string, string> = {
        ...options.headers,
        [CLIENT_VERSION_HEADER]: clientHeader,
      };

      // FAIL-OPEN: attach the token only if we have one; otherwise the request
      // still goes out unattested (server treats us as anonymous / lowest
      // trust — fail-open for reads, threat-model T2).
      if (token) {
        headers[APP_CHECK_HEADER] = token;
      }

      return doFetch(joinUrl(config.baseUrl, path), {
        method: options.method ?? 'GET',
        headers,
        body: options.body ?? undefined,
        signal: options.signal,
      });
    },
  };
}
