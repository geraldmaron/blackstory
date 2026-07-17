/**
 * Safe outbound HTTP port shared by the community discovery adapters
 * (RSS/Atom, Internet Archive, DPLA v2, Wayback SPN).
 *
 * `@black-book/domain` cannot import `@black-book/security` in shipped (non-test) code 
 * `@black-book/security` already depends on `@black-book/domain` at runtime, so the reverse
 * edge would be a circular workspace dependency (the same rule documented in
 * `../../../rights/takedown.ts` and `../../../map/map-source.ts`). `@black-book/security` is
 * listed only as a devDependency of this package for tests.
 *
 * So this module defines a dependency-injected **port** instead of calling directly.
 * Every adapter in rss/, internet-archive/, and dpla/ takes a `SafeHttpClient` as an argument
 * and never performs a bare `fetch`. Production wiring (outside this package, in the
 * apps/workers layer that already depends on both `@black-book/domain` and
 * `@black-book/security`) MUST implement `SafeHttpClient` by:
 * 1. Calling `evaluateExternalUrl` from `@black-book/security`'s url-safety module 
 * to reject disallowed schemes/ports/userinfo/domains before any I/O.
 * 2. Calling `resolveAndPinDestination` to resolve DNS once, reject private/loopback/
 * link-local/metadata answers, and pin the connection to a specific public IP.
 * 3. Connecting to the pinned IP while sending `hostname` for TLS SNI the Host header
 * (never trusting a second, unpinned DNS lookup) i.e. reusing `PinnedTransport`
 * contract, or `executeSafeFetch` directly for GET-only calls with no header/body needs.
 * A URL that fails safety evaluation must reject/throw never silently fall back to an
 * unpinned or unchecked request.
 *
 * See `http-port.test.ts` in this directory for a test that wires the REAL `@black-book/security`
 * primitives end-to-end (imported only there, as a devDependency) and proves an SSRF-targeted
 * URL is rejected before any adapter fetch would proceed the same pattern
 * `map-source.redaction.test.ts` uses to regression-test `@black-book/security` wiring without
 * creating a shipped runtime dependency.
 */

export type SafeHttpMethod = 'GET' | 'POST';

export type SafeHttpRequest = {
  readonly url: string;
  readonly method?: SafeHttpMethod;
  /** Extra request headers (e.g. Wayback SPN's `Authorization: LOW <key>:<secret>`). */
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Content types the caller will accept; a conforming SafeHttpClient enforces this allowlist. */
  readonly allowedContentTypes?: readonly string[];
};

export type SafeHttpResponse = {
  readonly status: number;
  /** Response headers, lower-cased keys. Needed for Wayback's `Content-Location` pointer. */
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly bodyText: string;
  readonly finalUrl: string;
};

/**
 * The injection seam every adapter depends on. Structurally intended to be backed by
 * safety primitives in production; fixtures/mocks back it in tests so the automated
 * suite never performs live network I/O.
 */
export type SafeHttpClient = (request: SafeHttpRequest) => Promise<SafeHttpResponse>;

export class SafeHttpError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = 'SafeHttpError';
  }
}

export type RetryOptions = {
  readonly retries: number;
  /** Base backoff in ms; actual delay is `baseDelayMs * 2^attempt`. */
  readonly baseDelayMs: number;
  readonly isRetryable: (response: SafeHttpResponse | undefined, error: unknown) => boolean;
  readonly sleep?: (ms: number) => Promise<void>;
};

export const DEFAULT_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Retries on 429/5xx (or a thrown transport error) with exponential backoff. No live timers in tests `sleep` is injectable. */
export async function withRetry(
  run: () => Promise<SafeHttpResponse>,
  options: RetryOptions,
): Promise<SafeHttpResponse> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let attempt = 0;
  while (true) {
    try {
      const response = await run();
      if (options.isRetryable(response, undefined) && attempt < options.retries) {
        attempt += 1;
        await sleep(options.baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt < options.retries && options.isRetryable(undefined, error)) {
        attempt += 1;
        await sleep(options.baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
  }
}

/** Default retry predicate: retry on 429/5xx statuses or a thrown SafeHttpError/network error. */
export function defaultIsRetryable(response: SafeHttpResponse | undefined, error: unknown): boolean {
  if (response) {
    return DEFAULT_RETRYABLE_STATUSES.has(response.status);
  }
  return error !== undefined;
}

/**
 * Modest bounded concurrency: runs `worker` over `items` with at most `limit` in flight.
 * Used for feed polling SPN capture submission so we never fan out unbounded requests.
 */
export async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  worker: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  if (limit <= 0) {
    throw new Error('mapWithConcurrency limit must be positive');
  }
  const results: Result[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as Item, index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

function contentTypeBase(value: string | undefined): string {
  return (value ?? '').split(';', 1)[0]!.trim().toLowerCase();
}

/**
 * Fails closed when the response's content type is not in the caller's allowlist. Mirrors
 * `executeSafeFetch`'s `content_type_not_allowed` rejection so adapters get the same
 * fail-closed behavior even though they use the generalized port rather than calling
 * `executeSafeFetch` directly (Wayback SPN needs POST + response headers, which
 * `executeSafeFetch`'s transport contract does not expose).
 */
export function assertAllowedContentType(
  response: SafeHttpResponse,
  allowedContentTypes: readonly string[],
): void {
  const actual = contentTypeBase(response.headers['content-type']);
  if (!allowedContentTypes.map((value) => value.toLowerCase()).includes(actual)) {
    throw new SafeHttpError(
      `Response content type "${actual}" is not in the allowed set: ${allowedContentTypes.join(', ')}`,
      'content_type_not_allowed',
    );
  }
}
