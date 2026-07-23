/**
 * `/v1` public read handlers (MOB-004).
 *
 * Each handler is a pure async function over an already-parsed `ApiRequest` + injected `HandlerDeps`
 * — no `node:http` types leak in here, so handlers are unit-testable without a socket. The
 * `node:http` adapter lives in `./server.ts`.
 *
 * Every 200 body is validated against the corresponding `@repo/public-contracts` zod schema before
 * it is returned (belt-and-suspenders with the port-level validation in `data-access.ts`): a body
 * that fails its contract is a server bug and becomes an `INTERNAL` error, never a malformed
 * payload on the wire.
 *
 * Client attestation posture (Threat model T1/T2; ADR-010 / ADR-020):
 *   - `X-BlackStory-Client` is an abuse-trust signal for direct API callers (mobile), not
 *     authorization. A missing header NEVER hard-denies a read — it feeds rate limits as the
 *     lowest-trust anonymous subject (fail-open for static reads; expensive reads need the header
 *     or they hit `app_check_required` via quota policy).
 *   - Replaces Firebase App Check after the Postgres cutover; web uses same-origin request
 *     integrity on Next.js routes instead.
 */
import type { ClientAttestationDecision, ClientAttestationHeaders } from '@repo/security';
import {
  encodeSearchCursor,
  type QueryGuardrailDecisionAllowed,
  type RateLimitSubject,
} from '@repo/security';
import { bootstrapResponseV1Schema } from '@repo/public-contracts/v1/bootstrap';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import { mapSourceV1Schema } from '@repo/public-contracts/v1/map';
import {
  searchResponseV1Schema,
  type SearchResponseV1,
} from '@repo/public-contracts/v1/search';
import { evaluateCompatibility } from '@repo/public-contracts/v1/compatibility';
import {
  API_VERSION,
  DEPRECATION_WINDOW_DAYS,
  MIN_SUPPORTED_API_VERSION,
} from '@repo/public-contracts/version';
import { health } from '../index.js';
import type { createPublicRateLimitGuard } from '../rate-limits.js';
import type { createPublicSearchGuard} from '../search-guardrails.js';
import { type PublicSearchHttpQuery } from '../search-guardrails.js';
import { buildMapSourceV1 } from './build-map-source-v1.js';
import type { PublicDataAccess } from './data-access.js';
import { CACHE_CONTROL, errorResponse, jsonRead, type ApiResponse } from './responses.js';

/** Parsed request the handlers operate on. The `server.ts` adapter builds this from `node:http`. */
export type ApiRequest = {
  readonly method: string;
  /** Path only, without the query string. */
  readonly path: string;
  readonly query: URLSearchParams;
  /** Header names lowercased; single value per name. */
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly requestId: string;
  readonly clientIp?: string;
};

export type HandlerDeps = {
  readonly dataAccess: PublicDataAccess;
  readonly clientAttestationGuard: (
    request: { readonly headers: ClientAttestationHeaders },
  ) => Promise<ClientAttestationDecision>;
  readonly rateLimitGuard: ReturnType<typeof createPublicRateLimitGuard>;
  readonly searchGuard: ReturnType<typeof createPublicSearchGuard>;
};

const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

// ---------------------------------------------------------------------------
// Client-version floor (ADR-021 §2)
// ---------------------------------------------------------------------------

/** Parses `X-BlackStory-Client: <platform>/<semver>; api=<n>` into a normalized `v<n>` api major.
 * Absent/unparseable header → `undefined` (unknown), which is treated as "not below floor": the
 * floor is a UX affordance for HONEST clients (ADR-021 red-team resolution #2), never a security
 * gate, so we never fail-closed on a missing header. */
export function parseClientApiVersion(headerValue: string | undefined): string | undefined {
  if (!headerValue) return undefined;
  const apiMatch = /(?:^|;|\s)api=(\d{1,5})\b/i.exec(headerValue);
  if (apiMatch?.[1]) return `v${apiMatch[1]}`;
  return undefined;
}

/** Returns a `426 CLIENT_VERSION_UNSUPPORTED` response when the caller declares an api major below
 * the enforced floor, else `null` (serve normally). */
function enforceClientFloor(request: ApiRequest): ApiResponse | null {
  const clientApiVersion = parseClientApiVersion(request.headers['x-blackstory-client']);
  if (clientApiVersion === undefined) return null;
  const compat = evaluateCompatibility({ clientApiVersion });
  if (compat.supported) return null;
  return errorResponse(
    'CLIENT_VERSION_UNSUPPORTED',
    'This app version is no longer supported. Please update to continue.',
    {
      requestId: request.requestId,
      details: { minSupportedApiVersion: MIN_SUPPORTED_API_VERSION, currentApiVersion: API_VERSION },
    },
  );
}

// ---------------------------------------------------------------------------
// GET /v1/health
// ---------------------------------------------------------------------------

export function handleHealth(request: ApiRequest): ApiResponse {
  // Exposes the existing `health()` surface posture. No App Check, no cache (operator sees live).
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CACHE_CONTROL.operational,
      'X-Request-Id': request.requestId,
    },
    body: health(),
  };
}

// ---------------------------------------------------------------------------
// GET /v1/compatibility
// ---------------------------------------------------------------------------

export function handleCompatibility(request: ApiRequest): ApiResponse {
  const clientApiVersion =
    parseClientApiVersion(request.headers['x-blackstory-client']) ?? API_VERSION;
  const compat = evaluateCompatibility({ clientApiVersion });

  if (!compat.supported) {
    return errorResponse(
      'CLIENT_VERSION_UNSUPPORTED',
      'This app version is no longer supported. Please update to continue.',
      {
        requestId: request.requestId,
        details: {
          minSupportedApiVersion: compat.minSupportedApiVersion,
          currentApiVersion: compat.currentApiVersion,
        },
      },
    );
  }

  // A supported-but-not-current client gets a soft `Deprecation` signal (ADR-021 red-team
  // resolution #1) so the client can surface an "update available" nudge before the hard floor.
  const extraHeaders = compat.softDeprecated ? { Deprecation: 'true' } : undefined;
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CACHE_CONTROL.operational,
      'X-Request-Id': request.requestId,
      ...extraHeaders,
    },
    body: compat,
  };
}

// ---------------------------------------------------------------------------
// GET /v1/bootstrap
// ---------------------------------------------------------------------------

export async function handleBootstrap(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  const floor = enforceClientFloor(request);
  if (floor) return floor;

  // App Check as a signal only — never denies (fail-open, T2).
  await deps.clientAttestationGuard({ headers: request.headers });

  const pointer = await deps.dataAccess.getReleasePointer();
  if (!pointer) {
    return errorResponse('UPSTREAM_UNAVAILABLE', 'No active release is available yet.', {
      requestId: request.requestId,
    });
  }

  const body = {
    apiVersion: API_VERSION,
    minSupportedApiVersion: MIN_SUPPORTED_API_VERSION,
    deprecationWindowDays: DEPRECATION_WINDOW_DAYS,
    activeRelease: pointer.activeRelease,
    ...(pointer.searchIndexVersion ? { searchIndexVersion: pointer.searchIndexVersion } : {}),
    ...(pointer.contentVersion ? { contentVersion: pointer.contentVersion } : {}),
  };

  const parsed = bootstrapResponseV1Schema.safeParse(body);
  if (!parsed.success) {
    return internalContractError(request);
  }
  return jsonRead(parsed.data, {
    requestId: request.requestId,
    cacheControl: CACHE_CONTROL.releasePointer,
    ifNoneMatch: request.headers['if-none-match'],
  });
}

// ---------------------------------------------------------------------------
// GET /v1/entity/:id
// ---------------------------------------------------------------------------

export async function handleEntity(
  request: ApiRequest,
  entityId: string,
  deps: HandlerDeps,
): Promise<ApiResponse> {
  const floor = enforceClientFloor(request);
  if (floor) return floor;

  // Strict id-format validation BEFORE use (T4 deep-link injection): never concatenate an
  // unvalidated id into a lookup path.
  if (!ENTITY_ID_PATTERN.test(entityId)) {
    return errorResponse('INVALID_REQUEST', 'Malformed entity id.', {
      requestId: request.requestId,
    });
  }

  const attestation = await deps.clientAttestationGuard({ headers: request.headers });

  const rateLimited = await runRateLimit(request, '/v1/entity/' + entityId, deps, attestation);
  if (rateLimited.limitResponse) return rateLimited.limitResponse;

  try {
    const pointer = await deps.dataAccess.getReleasePointer();
    if (!pointer) {
      return errorResponse('UPSTREAM_UNAVAILABLE', 'No active release is available yet.', {
        requestId: request.requestId,
      });
    }

    const entity = await deps.dataAccess.getEntity(pointer.activeRelease.releaseId, entityId);
    // IDENTICAL 404 for nonexistent AND unpublished — a client must not distinguish them (T3).
    if (!entity) {
      return notFoundEntity(request);
    }

    const parsed = entityV1Schema.safeParse(entity);
    if (!parsed.success) {
      return internalContractError(request);
    }
    return jsonRead(parsed.data, {
      requestId: request.requestId,
      cacheControl: CACHE_CONTROL.releasedRead,
      ifNoneMatch: request.headers['if-none-match'],
    });
  } finally {
    rateLimited.release();
  }
}

/** The single canonical NOT_FOUND envelope. Kept in one place so "unpublished" and "nonexistent"
 * are provably byte-identical (modulo the per-request id). */
function notFoundEntity(request: ApiRequest): ApiResponse {
  return errorResponse('NOT_FOUND', 'No such entity in the active release.', {
    requestId: request.requestId,
  });
}

// ---------------------------------------------------------------------------
// GET /v1/map
// ---------------------------------------------------------------------------

/** Release-coupled redacted GeoJSON FeatureCollection for Explore (ADR-025 / MapSourceV1). */
export async function handleMap(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  const floor = enforceClientFloor(request);
  if (floor) return floor;

  const attestation = await deps.clientAttestationGuard({ headers: request.headers });

  const rateLimited = await runRateLimit(request, '/v1/map', deps, attestation);
  if (rateLimited.limitResponse) return rateLimited.limitResponse;

  try {
    const pointer = await deps.dataAccess.getReleasePointer();
    if (!pointer) {
      return errorResponse('UPSTREAM_UNAVAILABLE', 'No active release is available yet.', {
        requestId: request.requestId,
      });
    }

    const releaseId = pointer.activeRelease.releaseId;
    const entities = await deps.dataAccess.listEntities(releaseId);
    const body = buildMapSourceV1(releaseId, entities, {
      generatedAt: pointer.activeRelease.generatedAt,
    });

    const parsed = mapSourceV1Schema.safeParse(body);
    if (!parsed.success) {
      return internalContractError(request);
    }
    return jsonRead(parsed.data, {
      requestId: request.requestId,
      cacheControl: CACHE_CONTROL.releasedRead,
      ifNoneMatch: request.headers['if-none-match'],
    });
  } finally {
    rateLimited.release();
  }
}

// ---------------------------------------------------------------------------
// GET /v1/search
// ---------------------------------------------------------------------------

export async function handleSearch(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  const floor = enforceClientFloor(request);
  if (floor) return floor;

  const attestation = await deps.clientAttestationGuard({ headers: request.headers });

  const rateLimited = await runRateLimit(request, '/v1/search', deps, attestation);
  if (rateLimited.limitResponse) return rateLimited.limitResponse;

  try {
    const decision = deps.searchGuard.evaluate({
      method: 'GET',
      path: '/v1/search',
      query: toSearchHttpQuery(request.query),
    });
    // `evaluate` returns null only for a non-search path; we always pass the search path here.
    if (decision === null) {
      return internalContractError(request);
    }
    if (!decision.allowed) {
      return errorResponse('INVALID_REQUEST', decision.message, {
        requestId: request.requestId,
        details: { reason: decision.reason },
      });
    }

    const pointer = await deps.dataAccess.getReleasePointer();
    if (!pointer) {
      return errorResponse('UPSTREAM_UNAVAILABLE', 'No active release is available yet.', {
        requestId: request.requestId,
      });
    }

    const page = await deps.dataAccess.search(decision.canonical, {
      releaseId: pointer.activeRelease.releaseId,
    });

    const body: SearchResponseV1 = {
      results: [...page.results],
      facets: page.facets,
      totalMatched: page.totalMatched,
      hasMore: page.hasMore,
      ...(page.hasMore ? { nextCursor: mintCursor(decision) } : {}),
    };

    const parsed = searchResponseV1Schema.safeParse(body);
    if (!parsed.success) {
      return internalContractError(request);
    }
    return jsonRead(parsed.data, {
      requestId: request.requestId,
      cacheControl: CACHE_CONTROL.releasedRead,
      ifNoneMatch: request.headers['if-none-match'],
    });
  } finally {
    rateLimited.release();
  }
}

/** Opaque cursor cryptographically bound to the canonical query hash (T3): a client cannot forge a
 * cursor to jump scan position or change the query mid-walk. Mirrors the web handler's encoding —
 * embed the CURRENT depth so the guardrail's own +1 lands on exactly the next page. */
function mintCursor(decision: QueryGuardrailDecisionAllowed): string {
  const offset = (decision.canonical.depth - 1) * decision.canonical.pageSize;
  return encodeSearchCursor({
    v: 1,
    depth: decision.canonical.depth,
    queryHash: decision.queryHash,
    position: String(offset + decision.canonical.pageSize),
  });
}

const SEARCH_QUERY_KEYS = [
  'q',
  'kind',
  'state',
  'precision',
  'releaseId',
  'sort',
  'pageSize',
  'cursor',
  'dateFrom',
  'dateTo',
  // Prohibited-shape keys are forwarded (not dropped) so the guardrail denies them explicitly.
  'sql',
  'regex',
  'pattern',
  'orderBy',
  'fields',
  'select',
] as const;

function toSearchHttpQuery(query: URLSearchParams): PublicSearchHttpQuery {
  const out: Record<string, string> = {};
  for (const key of SEARCH_QUERY_KEYS) {
    const value = query.get(key);
    if (value !== null) out[key] = value;
  }
  return out as PublicSearchHttpQuery;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const RATE_LIMIT_SUBJECT: RateLimitSubject = 'anonymous';

/** Runs the rate-limit guard and returns a denial response (if any) plus a `release` that frees the
 * concurrency slot. `clientAttested` feeds the evaluator for expensive-read trust. */
async function runRateLimit(
  request: ApiRequest,
  path: string,
  deps: HandlerDeps,
  attestation: ClientAttestationDecision,
): Promise<{ readonly limitResponse: ApiResponse | null; readonly release: () => void }> {
  const decision = deps.rateLimitGuard.evaluate({
    method: 'GET',
    path,
    subject: RATE_LIMIT_SUBJECT,
    clientAttested: attestation.verified,
    ...(request.clientIp ? { clientIp: request.clientIp } : {}),
  });

  if (decision === null) {
    return { limitResponse: null, release: () => {} };
  }
  if (!decision.allowed) {
    const formatted = deps.rateLimitGuard.formatDeniedResponse(decision);
    const retryAfter = formatted.headers?.['Retry-After'];
    return {
      limitResponse: errorResponse('RATE_LIMITED', 'Rate limit exceeded. Retry later.', {
        requestId: request.requestId,
        ...(retryAfter ? { extraHeaders: { 'Retry-After': String(retryAfter) } } : {}),
      }),
      release: () => {},
    };
  }
  return {
    limitResponse: null,
    release: () => deps.rateLimitGuard.release(decision.key),
  };
}

function internalContractError(request: ApiRequest): ApiResponse {
  return errorResponse('INTERNAL', 'The server produced an unexpected response.', {
    requestId: request.requestId,
  });
}
