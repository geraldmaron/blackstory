/**
 * Guardrails for the semantic (`find_nearest`) search endpoint (BB-071), layered directly on
 * top of the existing BB-026 text-search guardrails rather than reinventing them.
 *
 * Reuse, concretely: the natural-language query text goes through the exact same
 * `evaluateSearchQueryGuardrails` validation as `/v1/search` (Unicode normalization, length
 * bounds, `kind`/`state` filter allowlisting), and the neighbor count `k` is mapped onto that
 * same function's `pageSize` field — so the "capped limit must be <= existing page-size caps"
 * requirement is enforced by the *same* limits object (`DEFAULT_QUERY_GUARDRAIL_LIMITS`: default
 * 20, max 50), not a re-implemented one. `toBaseSearchQueryInput` only forwards the specific
 * fields this endpoint accepts (`q`, `kind`, `state`, `k`) — there is no way to smuggle a
 * prohibited field (`sql`, `regex`, `fields`, …) through this narrower HTTP query type, so that
 * part of the base guardrail's prohibited-field check is structurally unreachable here rather
 * than actively exercised. This file only adds validation for the two fields the base guardrail
 * doesn't know about: `distanceThreshold` and `eraBucket`.
 *
 * Route: `GET /v1/search/nearest`. That path is a sub-path of `/v1/search`, so it already
 * matches the existing `SEARCH_PATH` prefix regex in both `search-guardrails.ts` and
 * `rate-limits.ts` — `resolvePublicEndpointClass` (rate-limits.ts, unedited) therefore already
 * classifies it under the `search` endpoint class and BB-025 rate limiting applies without any
 * change to that file.
 */
import {
  evaluateSearchQueryGuardrails,
  normalizeSearchText,
  DEFAULT_QUERY_GUARDRAIL_LIMITS,
  type QueryGuardrailDenialReason,
  type SearchQueryInput,
} from '@black-book/security';

export const VECTOR_SEARCH_PATH = /^\/v1\/search\/nearest(?:\/|$)/i;

export function isVectorSearchPath(path: string, method: string): boolean {
  const normalized = path.split('?')[0] ?? path;
  return method.toUpperCase() === 'GET' && VECTOR_SEARCH_PATH.test(normalized);
}

export type VectorSearchHttpQuery = {
  readonly q?: string;
  readonly kind?: string;
  readonly state?: string;
  readonly eraBucket?: string;
  /** Neighbor count. Reuses the base guardrail's pageSize bounds (default 20, max 50). */
  readonly k?: string;
  /** DOT_PRODUCT threshold — higher is more similar; must fall within [-1, 1]. */
  readonly distanceThreshold?: string;
};

export type VectorSearchGuardRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: VectorSearchHttpQuery;
};

export type VectorSearchDenialReason =
  | QueryGuardrailDenialReason
  | 'era_bucket_invalid'
  | 'distance_threshold_invalid';

export const DEFAULT_DISTANCE_THRESHOLD = 0.5;
const MAX_ERA_BUCKET_LENGTH = 16;

export type CanonicalVectorSearchQuery = {
  readonly queryText: string;
  readonly kind?: string;
  readonly state?: string;
  readonly eraBucket?: string;
  readonly k: number;
  readonly distanceThreshold: number;
};

export type VectorSearchGuardDecisionAllowed = {
  readonly allowed: true;
  readonly canonical: CanonicalVectorSearchQuery;
  readonly cacheKey: string;
  readonly queryHash: string;
  readonly timeoutMs: number;
  readonly firestoreTimeoutMs: number;
  readonly path: string;
  readonly endpointClass: 'search';
};

export type VectorSearchGuardDecisionDenied = {
  readonly allowed: false;
  readonly reason: VectorSearchDenialReason;
  readonly message: string;
  readonly path: string;
  readonly endpointClass: 'search';
};

export type VectorSearchGuardDecision =
  | VectorSearchGuardDecisionAllowed
  | VectorSearchGuardDecisionDenied;

function deny(
  path: string,
  reason: VectorSearchDenialReason,
  message: string,
): VectorSearchGuardDecisionDenied {
  return { allowed: false, reason, message, path, endpointClass: 'search' };
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Maps the vector-search HTTP query onto the shared BB-026 SearchQueryInput shape. */
export function toBaseSearchQueryInput(raw: VectorSearchHttpQuery): SearchQueryInput {
  const filters: Record<string, string> = {};
  if (raw.kind !== undefined) filters.kind = raw.kind;
  if (raw.state !== undefined) filters.state = raw.state;

  const pageSize = parseOptionalInt(raw.k);

  return {
    ...(raw.q !== undefined ? { q: raw.q } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
  };
}

/**
 * Validates a `/v1/search/nearest` request: the shared text/filter guardrail first, then the
 * vector-specific `distanceThreshold`/`eraBucket` fields. Fails closed — any invalid field
 * denies the whole request rather than silently dropping it.
 */
export function evaluateVectorSearchGuardrails(
  request: VectorSearchGuardRequest,
): VectorSearchGuardDecision {
  const baseInput = toBaseSearchQueryInput(request.query);
  const baseDecision = evaluateSearchQueryGuardrails(baseInput);

  if (!baseDecision.allowed) {
    return deny(request.path, baseDecision.reason, baseDecision.message);
  }
  if (!baseDecision.canonical.q) {
    return deny(
      request.path,
      'empty_query',
      'Semantic search requires a non-empty natural-language query (q).',
    );
  }

  let eraBucket: string | undefined;
  if (request.query.eraBucket !== undefined) {
    const normalized = normalizeSearchText(request.query.eraBucket);
    if (!normalized || normalized.length > MAX_ERA_BUCKET_LENGTH) {
      return deny(request.path, 'era_bucket_invalid', 'eraBucket is empty or too long.');
    }
    eraBucket = normalized;
  }

  const distanceThreshold = parseOptionalFloat(request.query.distanceThreshold) ?? DEFAULT_DISTANCE_THRESHOLD;
  if (!Number.isFinite(distanceThreshold) || distanceThreshold < -1 || distanceThreshold > 1) {
    return deny(
      request.path,
      'distance_threshold_invalid',
      'distanceThreshold must be a finite number within [-1, 1] (DOT_PRODUCT of unit vectors).',
    );
  }

  const kindFilter = baseDecision.canonical.filters.find((filter) => filter.field === 'kind');
  const stateFilter = baseDecision.canonical.filters.find((filter) => filter.field === 'state');

  const canonical: CanonicalVectorSearchQuery = {
    queryText: baseDecision.canonical.q,
    ...(kindFilter ? { kind: kindFilter.value } : {}),
    ...(stateFilter ? { state: stateFilter.value } : {}),
    ...(eraBucket ? { eraBucket } : {}),
    k: baseDecision.canonical.pageSize,
    distanceThreshold,
  };

  return {
    allowed: true,
    canonical,
    cacheKey: baseDecision.cacheKey,
    queryHash: baseDecision.queryHash,
    timeoutMs: baseDecision.timeoutMs,
    firestoreTimeoutMs: baseDecision.firestoreTimeoutMs,
    path: request.path,
    endpointClass: 'search',
  };
}

export type VectorSearchGuardDeniedResponse = {
  readonly status: 400;
  readonly body: {
    readonly error: 'invalid_vector_search_query';
    readonly reason: VectorSearchDenialReason;
    readonly message: string;
  };
};

export function formatVectorSearchGuardDeniedResponse(
  decision: VectorSearchGuardDecisionDenied,
): VectorSearchGuardDeniedResponse {
  return {
    status: 400,
    body: {
      error: 'invalid_vector_search_query',
      reason: decision.reason,
      message: decision.message,
    },
  };
}

/** The max neighbor count this guard can ever allow — equals the base pageSize cap (<= platform ceiling). */
export const MAX_VECTOR_SEARCH_K = DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPageSize;
