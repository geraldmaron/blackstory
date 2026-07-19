/**
 * Typed HTTP transport (MOB-009 §1).
 *
 * Wraps the App Check-attaching `ApiClient` from `src/security/api-client.ts`
 * (MOB-010) — it does NOT reimplement token attachment. On top of that thin
 * security wrapper this adds the read-path concerns ADR-022/threat-model need:
 *
 *   - Cancellation via AbortController; a superseding request cancels the
 *     in-flight one it replaces (e.g. a new keystroke supersedes a search).
 *   - Bounded exponential backoff + jitter, for IDEMPOTENT READS ONLY. A
 *     mutation is NEVER retried (double-submit hazard) — `mutate()` has no
 *     retry path at all.
 *   - `Retry-After` header respect on 429/503.
 *   - ETag / `If-None-Match` conditional requests with 304 handling: a 304
 *     returns `notModified: true` and no body, so the caller keeps its cached
 *     copy (backs ADR-022 TTL revalidation without re-sending the payload).
 *   - A hard response-size cap enforced BEFORE JSON parsing (threat-model:
 *     maliciously large payload must not be parsed/cached).
 *
 * Every dependency that makes tests non-deterministic (`sleep`, `random`, the
 * monotonic clock) is injectable so backoff/jitter/Retry-After are testable
 * without real timers.
 */
import type { ApiClient, ApiRequestOptions } from '../security/api-client';

/** ~8 MB: far above any legitimate `/v1` JSON body, well below anything that
 * could exhaust device memory. A response exceeding this is rejected unparsed. */
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export interface TransportRetryPolicy {
  /** Total attempts INCLUDING the first (so 1 == no retry). */
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Absolute cap on any single `Retry-After` we will honour (anti-DoS). */
  readonly maxRetryAfterMs: number;
}

export const DEFAULT_RETRY_POLICY: TransportRetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 300,
  maxDelayMs: 5000,
  maxRetryAfterMs: 30_000,
};

export interface TransportDeps {
  readonly apiClient: ApiClient;
  readonly retry?: Partial<TransportRetryPolicy>;
  /** Injectable for deterministic tests. Defaults to real timer / Math.random. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly maxResponseBytes?: number;
}

export interface ReadOptions {
  /** Caller's cancellation signal (e.g. component unmount). */
  readonly signal?: AbortSignal;
  /** Known ETag → sent as `If-None-Match` for conditional revalidation. */
  readonly etag?: string;
}

export type ReadResult<T> =
  | { readonly kind: 'ok'; readonly status: number; readonly data: T; readonly etag?: string }
  | { readonly kind: 'not-modified'; readonly status: 304; readonly etag?: string };

export class TransportError extends Error {
  constructor(
    message: string,
    readonly info: {
      readonly kind: 'network' | 'http' | 'aborted' | 'too-large' | 'parse';
      readonly status?: number;
      readonly attempts: number;
    },
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || /abort/i.test(err.message))
  );
}

export interface Transport {
  /** Idempotent read with retries, ETag revalidation and size cap. */
  readJson<T>(path: string, options?: ReadOptions): Promise<ReadResult<T>>;
  /** NON-idempotent write. NEVER retried. Returns the raw Response for the
   *  caller (e.g. corrections) to interpret; no body caching happens here. */
  mutate(path: string, options: ApiRequestOptions): Promise<Response>;
}

export function createTransport(deps: TransportDeps): Transport {
  const policy: TransportRetryPolicy = { ...DEFAULT_RETRY_POLICY, ...deps.retry };
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const sizeCap = deps.maxResponseBytes ?? MAX_RESPONSE_BYTES;

  function backoffMs(attempt: number, retryAfterMs: number | undefined): number {
    if (retryAfterMs !== undefined) {
      return Math.min(retryAfterMs, policy.maxRetryAfterMs);
    }
    const exp = policy.baseDelayMs * 2 ** (attempt - 1);
    const capped = Math.min(exp, policy.maxDelayMs);
    // Full jitter: uniform in [0, capped]. Bounds the request rate under a
    // retry storm (no thundering herd, no unbounded growth).
    return Math.floor(random() * capped);
  }

  async function enforceSizeAndParse<T>(response: Response): Promise<T> {
    const declared = response.headers.get('content-length');
    if (declared !== null && Number(declared) > sizeCap) {
      throw new TransportError('response exceeds size cap (declared)', {
        kind: 'too-large',
        status: response.status,
        attempts: 0,
      });
    }
    // Even when Content-Length is absent or lies, cap on the materialized text
    // BEFORE JSON.parse so a malicious body is never parsed into an object.
    const text = await response.text();
    if (text.length > sizeCap) {
      throw new TransportError('response exceeds size cap (body)', {
        kind: 'too-large',
        status: response.status,
        attempts: 0,
      });
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new TransportError('response body is not valid JSON', {
        kind: 'parse',
        status: response.status,
        attempts: 0,
      });
    }
  }

  async function readJson<T>(path: string, options: ReadOptions = {}): Promise<ReadResult<T>> {
    const headers: Record<string, string> = {};
    if (options.etag) headers['If-None-Match'] = options.etag;

    let lastError: unknown;
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      if (options.signal?.aborted) {
        throw new TransportError('request aborted before send', { kind: 'aborted', attempts: attempt - 1 });
      }
      let response: Response;
      try {
        response = await deps.apiClient.request(path, {
          method: 'GET',
          headers,
          signal: options.signal,
        });
      } catch (err) {
        if (isAbortError(err)) {
          throw new TransportError('request aborted', { kind: 'aborted', attempts: attempt });
        }
        // Network-level failure: retryable.
        lastError = err;
        if (attempt < policy.maxAttempts) {
          await sleep(backoffMs(attempt, undefined));
          continue;
        }
        throw new TransportError('network request failed', { kind: 'network', attempts: attempt });
      }

      if (response.status === 304) {
        return { kind: 'not-modified', status: 304, etag: response.headers.get('etag') ?? options.etag };
      }
      if (response.status >= 200 && response.status < 300) {
        const data = await enforceSizeAndParse<T>(response);
        return { kind: 'ok', status: response.status, data, etag: response.headers.get('etag') ?? undefined };
      }

      // Non-2xx.
      if (RETRYABLE_STATUS.has(response.status) && attempt < policy.maxAttempts) {
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
        await sleep(backoffMs(attempt, retryAfterMs));
        continue;
      }
      throw new TransportError(`HTTP ${response.status}`, {
        kind: 'http',
        status: response.status,
        attempts: attempt,
      });
    }
    // Exhausted retries on network errors.
    throw new TransportError('exhausted retries', {
      kind: 'network',
      attempts: policy.maxAttempts,
    });
  }

  async function mutate(path: string, options: ApiRequestOptions): Promise<Response> {
    // NO retry, NO size-cap-parse: mutations are single-shot and their bodies
    // are never cached to disk (ADR-022 §2 never-cache list covers correction
    // content). The caller owns interpretation.
    return deps.apiClient.request(path, options);
  }

  return { readJson, mutate };
}

/** Parses `Retry-After` (delta-seconds or an HTTP-date) into ms, or undefined. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, date - now);
  }
  return undefined;
}

/**
 * A single-slot superseding fetcher: each call aborts the previous in-flight
 * call before starting a new one. This is how a new search keystroke cancels
 * the prior request (ADR-022 request de-dup / cancellation). The returned
 * function threads a fresh AbortSignal into `run`.
 */
export function createSupersedingRunner() {
  let current: AbortController | null = null;
  return async function run<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    try {
      return await fn(controller.signal);
    } finally {
      if (current === controller) current = null;
    }
  };
}
