/**
 * Stable HTTP response primitives for the `/v1` public read API.
 *
 * These helpers are server-only (they use `node:crypto` for ETag/request-id hashing) and live in
 * `apps/api-public` — NOT in `@repo/public-contracts`, which must stay node-free for the mobile
 * bundle and is gated on that by `packages/public-contracts/scripts/check-boundary.mjs` (see
 * `docs/decisions-carryover.md`, "ADR-021's two invariants": the public-contracts boundary).
 * They emit the *shared* error envelope and error codes that the contracts
 * package defines (`@repo/public-contracts/errors`), so client and server agree on the wire shape
 * at compile time.
 *
 * Every response the router returns carries: a request id (for log correlation, echoed in the
 * body's error envelope and the `X-Request-Id` header), an explicit `Cache-Control`, and — for
 * cacheable reads — a strong `ETag` so clients and CDNs can revalidate with `If-None-Match`
 * (the snapshot and CDN-friendliness rule in `docs/decisions-carryover.md`, "Public projection
 * and immutable publication snapshots").
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

/** Cache-Control presets. Public released projection data is CDN-cacheable
 * (`docs/decisions-carryover.md`, "Public projection and immutable publication snapshots");
 * operational metadata (health, compatibility) is never cached so an operator sees live posture. */
export const CACHE_CONTROL = {
  /** Released search projections — short edge cache + generous stale-while-revalidate. */
  releasedRead: 'public, max-age=60, stale-while-revalidate=300',
  /**
   * Release-coupled catalog reads (`/v1/map`, `/v1/entity/{id}`): the body changes only when a
   * release is published or an artifact is corrected, and the mobile app fetches the map on
   * every launch. Measured 2026-09-22: 759 KB gzipped, 6.7 s on a cold function, with a 60 s edge
   * TTL that made nearly every launch a rebuild (`repo-ogo3j.6`). `max-age` stays short so an
   * installed client picks up a correction promptly; `s-maxage` keeps Vercel's edge serving it
   * for an hour and revalidating in the background for a day after that.
   */
  releasedCatalog: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
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

/**
 * A permanent redirect with an empty body.
 *
 * 308, not 301, for two reasons: it is what `apps/web`'s `permanentRedirect` emits, so the two
 * public surfaces answer a merged-away id the same way; and 301 permits a client to rewrite the
 * method, which a read surface should never invite even though it only serves GET/HEAD.
 *
 * Cached like any other released read rather than `no-store`: the target of a merge redirect is
 * as stable as the record it points at, and an uncacheable redirect would put every stale link
 * through a function on every hit.
 */
export function permanentRedirectResponse(
  location: string,
  options: { readonly requestId: string },
): ApiResponse {
  return {
    status: 308,
    headers: {
      Location: location,
      'Cache-Control': CACHE_CONTROL.releasedRead,
      'X-Request-Id': options.requestId,
    },
    body: null,
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
 * never a stack trace, internal path, collection name, or secret. Nothing inspects the string a
 * caller passes: `publicApiErrorSchema` bounds shape and size only, so this one is discipline at
 * each call site, not a gate (`docs/decisions-carryover.md`, "ADR-021's two invariants":
 * public-response redaction).
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
