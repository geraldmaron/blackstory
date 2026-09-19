/**
 * Attach X-BlackStory-Client: mobile/<version>; api=<major> to every API request. The server
 * checks its format; callers can forge it, so it grants no authorization or higher quota.
 * Surface server responses unchanged and never log credentials.
 */

export const CLIENT_VERSION_HEADER = 'X-BlackStory-Client';

export interface ApiClientConfig {
  /** Base URL of `apps/api-public`, e.g. `https://api.blackstory.app`. */
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
  const clientHeader = buildClientVersionHeader(config.clientVersion, config.apiMajor);

  return {
    async request(path: string, options: ApiRequestOptions = {}): Promise<Response> {
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
