/**
 * Stable HTTP response primitives for the `/v1` public read API (MOB-004).
 *
 * These helpers are server-only (they use `node:crypto` for ETag/request-id hashing) and live in
 * `apps/api-public` — NOT in `@repo/public-contracts`, which must stay node-free for the mobile
 * bundle (ADR-021 §1). They emit the *shared* error envelope and error codes that the contracts
 * package defines (`@repo/public-contracts/errors`), so client and server agree on the wire shape
 * at compile time.
 *
 * Every response the router returns carries: a request id (for log correlation, echoed in the
 * body's error envelope and the `X-Request-Id` header), an explicit `Cache-Control`, and — for
 * cacheable reads — a strong `ETag` so clients and CDNs can revalidate with `If-None-Match`
 * (ADR-004 snapshot/CDN-friendliness).
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS,
  type PublicApiErrorCode,
  type PublicApiErrorEnvelope,
} from '@repo/public-contracts/errors';

export type ApiResponse = {
  readonly status: number;
  readonly headers: Record<string, string>;
  /** JSON-serializable body, or `null` for an empty body (e.g. a 304). */
  readonly body: unknown;
};

/** Cache-Control presets. Public released projection data is CDN-cacheable (ADR-004); operational
 * metadata (health, compatibility) is never cached so an operator sees live posture. */
export const CACHE_CONTROL = {
  /** Released entity/search projections — short edge cache + generous stale-while-revalidate. */
  releasedRead: 'public, max-age=60, stale-while-revalidate=300',
  /** Release pointer (bootstrap): shorter, because a new release must be picked up promptly. */
  releasePointer: 'public, max-age=30, stale-while-revalidate=120',
  /** Never cache operational/version endpoints. */
  operational: 'no-store',
} as const;

/** Maps each stable error code to the single HTTP status it is always paired with. */
const ERROR_CODE_STATUS: Record<PublicApiErrorCode, number> = {
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  RATE_LIMITED: 429,
  CLIENT_VERSION_UNSUPPORTED: CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export function newRequestId(): string {
  return `req_${randomUUID()}`;
}

/** Strong ETag over the canonical JSON serialization of a body. Deterministic for identical
 * bodies so a CDN/client `If-None-Match` revalidation is stable across instances. */
export function computeEtag(serializedBody: string): string {
  const digest = createHash('sha256').update(serializedBody).digest('base64url').slice(0, 27);
  return `"${digest}"`;
}

/**
 * Builds a `200` JSON response with an ETag and Cache-Control. If the request's `If-None-Match`
 * already matches the computed ETag, returns a bodiless `304 Not Modified` instead — the client's
 * cached copy is still current, so no payload is re-sent.
 */
export function jsonRead(
  body: unknown,
  options: {
    readonly requestId: string;
    readonly cacheControl: string;
    readonly ifNoneMatch?: string | undefined;
    readonly extraHeaders?: Record<string, string>;
  },
): ApiResponse {
  const serialized = JSON.stringify(body);
  const etag = computeEtag(serialized);
  const baseHeaders: Record<string, string> = {
    'Cache-Control': options.cacheControl,
    ETag: etag,
    'X-Request-Id': options.requestId,
    ...options.extraHeaders,
  };

  if (options.ifNoneMatch !== undefined && etagMatches(options.ifNoneMatch, etag)) {
    return { status: 304, headers: baseHeaders, body: null };
  }

  return {
    status: 200,
    headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body,
  };
}

/** `If-None-Match` may be a comma-separated list and may carry a `W/` weak prefix; match the
 * strong tag against any listed member. `*` matches any current representation. */
function etagMatches(ifNoneMatch: string, etag: string): boolean {
  const normalizedEtag = etag.replace(/^W\//, '');
  return ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .some((candidate) => candidate === '*' || candidate === normalizedEtag);
}

/**
 * Builds a stable error envelope response. The envelope shape and codes come from
 * `@repo/public-contracts/errors`; `message`/`details` are bounded, non-sensitive text only —
 * never a stack trace, internal path, collection name, or secret (ADR-021 §3 redaction discipline).
 */
export function errorResponse(
  code: PublicApiErrorCode,
  message: string,
  options: {
    readonly requestId: string;
    readonly details?: PublicApiErrorEnvelope['error']['details'];
    readonly extraHeaders?: Record<string, string>;
  },
): ApiResponse {
  const envelope: PublicApiErrorEnvelope = {
    error: {
      code,
      message,
      requestId: options.requestId,
      ...(options.details ? { details: options.details } : {}),
    },
  };
  return {
    status: ERROR_CODE_STATUS[code],
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CACHE_CONTROL.operational,
      'X-Request-Id': options.requestId,
      ...options.extraHeaders,
    },
    body: envelope,
  };
}
