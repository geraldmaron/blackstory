/**
 * Client-attestation header attachment layer (MOB-010).
 *
 * Thin security wrapper that, on EVERY outgoing request to `apps/api-public`,
 * attaches the client version-floor header `X-BlackStory-Client:
 * mobile/<version>; api=<major>` (ADR-021 §2 / handlers.ts
 * `parseClientApiVersion`). Server-side attestation validates this header via
 * the Postgres-backed client registry — not Firebase App Check.
 *
 * Design invariants:
 *   - The version header is attached on EVERY request — never silently omitted.
 *   - No token or attestation secret is logged (invariant 7) — see
 *     log-redaction.ts.
 *   - The client makes NO guarantee about server authorization; it surfaces
 *     server responses verbatim.
 */

export const CLIENT_VERSION_HEADER = 'X-BlackStory-Client';

export interface ApiClientConfig {
  /** Base URL of `apps/api-public`, e.g. `https://api.blackbook.app`. */
  readonly baseUrl: string;
  /** App version string, e.g. `1.0.0` (from `Constants.expoConfig.version`). */
  readonly clientVersion: string;
  /** API major version this build targets (the `/vN` prefix), e.g. `1`. */
  readonly apiMajor: number;
  /** Injected fetch (defaults to global `fetch`). */
  readonly fetch?: typeof fetch;
}

export interface ApiRequestOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: BodyInit | null;
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
 * Create the client-attesting API wrapper.
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
      const headers: Record<string, string> = {
        ...options.headers,
        [CLIENT_VERSION_HEADER]: clientHeader,
      };

      return doFetch(joinUrl(config.baseUrl, path), {
        method: options.method ?? 'GET',
        headers,
        body: options.body ?? undefined,
        signal: options.signal,
      });
    },
  };
}
