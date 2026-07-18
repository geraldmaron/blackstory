
/**
 * Search and query resource guardrails.
 *
 * Pure deterministic validation for public search: Unicode normalization, approved query
 * shapes only, bounded filters/radius/date/page depth, opaque cursor pagination, cache keys,
 * timeout policy, and slow-query telemetry shapes. Firestore-scoped; SQL paths deferred.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { EndpointClass } from './rate-limits.js';

export const QUERY_GUARDRAIL_POLICY_VERSION = '1.0.0' as const;

/** Endpoint class metadata for rate-limit integration. */
export const SEARCH_ENDPOINT_CLASS = 'search' as const satisfies EndpointClass;

/** Allowlisted sort keys no user-defined sort expressions. */
export type SearchSortKey =
  | 'relevance'
  | 'name_asc'
  | 'name_desc'
  | 'date_asc'
  | 'date_desc'
  | 'distance';

export const searchSortKeys = [
  'relevance',
  'name_asc',
  'name_desc',
  'date_asc',
  'date_desc',
  'distance',
] as const satisfies readonly SearchSortKey[];


/**
 * Allowlisted filter fields no arbitrary column selection. `status` and `era` were added for
 * AC5 ("the filter allowlist extends to status and era"), matching the 6 fields
 * `@blap/domain`'s search layer filters on (see `packages/domain/src/search/types.ts`).
 */
export type SearchFilterField = 'kind' | 'state' | 'precision' | 'releaseId' | 'status' | 'era';

export const searchFilterFields = [
  'kind',
  'state',
  'precision',
  'releaseId',
  'status',
  'era',
] as const satisfies readonly SearchFilterField[];

/** Approved query shapes executed by api-public (no ad-hoc SQL). */
export type ApprovedQueryShape =
  | 'text'
  | 'text_filters'
  | 'text_geo'
  | 'text_geo_filters'
  | 'filters_only'
  | 'geo_only';

export type SearchFilter = {
  readonly field: SearchFilterField;
  readonly value: string;
};

export type SearchGeoInput = {
  readonly lat: number;
  readonly lng: number;
  readonly radiusM: number;
};

export type SearchDateRange = {
  readonly from: string;
  readonly to: string;
};

/** Raw search input from HTTP handlers reject prohibited keys early. */
export type SearchQueryInput = {
  readonly q?: string;
  readonly filters?: Readonly<Record<string, string | undefined>>;
  readonly sort?: string;
  readonly pageSize?: number;
  readonly cursor?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly radiusM?: number;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  /** Prohibited presence triggers denial. */
  readonly fields?: readonly string[];
  readonly select?: readonly string[];
  readonly orderBy?: string;
  readonly sql?: string;
  readonly regex?: string;
  readonly pattern?: string;
};

export type CanonicalSearchQuery = {
  readonly q: string;
  readonly filters: readonly SearchFilter[];
  readonly sort: SearchSortKey;
  readonly pageSize: number;
  readonly depth: number;
  readonly geo?: SearchGeoInput;
  readonly dateRange?: SearchDateRange;
  readonly shape: ApprovedQueryShape;
};

export type QueryGuardrailDenialReason =
  | 'query_too_short'
  | 'query_too_long'
  | 'wildcard_only'
  | 'regex_not_allowed'
  | 'too_many_filters'
  | 'filter_field_not_allowed'
  | 'filter_value_invalid'
  | 'radius_exceeded'
  | 'radius_too_small'
  | 'geo_incomplete'
  | 'date_range_exceeded'
  | 'date_range_invalid'
  | 'page_size_exceeded'
  | 'pagination_depth_exceeded'
  | 'cursor_invalid'
  | 'sort_not_allowed'
  | 'field_selection_not_allowed'
  | 'sql_not_allowed'
  | 'prohibited_query_shape'
  | 'empty_query'
  | 'export_limit_exceeded';

export type QueryGuardrailDecisionAllowed = {
  readonly allowed: true;
  readonly canonical: CanonicalSearchQuery;
  readonly cacheKey: string;
  readonly queryHash: string;
  readonly timeoutMs: number;
  readonly firestoreTimeoutMs: number;
  readonly exportLimit: number;
  readonly estimatedCost: number;
  readonly policyVersion: typeof QUERY_GUARDRAIL_POLICY_VERSION;
  readonly endpointClass: typeof SEARCH_ENDPOINT_CLASS;
  readonly cursorPosition?: string;
};

export type QueryGuardrailDecisionDenied = {
  readonly allowed: false;
  readonly reason: QueryGuardrailDenialReason;
  readonly message: string;
  readonly policyVersion: typeof QUERY_GUARDRAIL_POLICY_VERSION;
};

export type QueryGuardrailDecision =
  | QueryGuardrailDecisionAllowed
  | QueryGuardrailDecisionDenied;

export type QueryGuardrailLimits = {
  readonly minQueryLength: number;
  readonly maxQueryLength: number;
  readonly maxFilters: number;
  readonly maxFilterValueLength: number;
  readonly minRadiusM: number;
  readonly maxRadiusM: number;
  readonly maxDateRangeDays: number;
  readonly maxPageSize: number;
  readonly defaultPageSize: number;
  readonly maxPaginationDepth: number;
  readonly maxExportResults: number;
  readonly queryTimeoutMs: number;
  readonly firestoreStatementTimeoutMs: number;
  readonly maxEstimatedCost: number;
};

export const DEFAULT_QUERY_GUARDRAIL_LIMITS: QueryGuardrailLimits = {
  minQueryLength: 2,
  maxQueryLength: 120,
  maxFilters: 5,
  maxFilterValueLength: 64,
  minRadiusM: 100,
  maxRadiusM: 50_000,
  maxDateRangeDays: 36_500,
  maxPageSize: 50,
  defaultPageSize: 20,
  maxPaginationDepth: 20,
  maxExportResults: 500,
  queryTimeoutMs: 5_000,
  firestoreStatementTimeoutMs: 4_000,
  maxEstimatedCost: 2_500,
};

export type SearchCursorPayload = {
  readonly v: 1;
  readonly depth: number;
  readonly queryHash: string;
  readonly position: string;
};

export type SlowQueryLogEvent = {
  readonly event: 'slow_query';
  readonly endpointClass: typeof SEARCH_ENDPOINT_CLASS;
  readonly queryHash: string;
  readonly shape: ApprovedQueryShape;
  readonly durationMs: number;
  readonly resultCount: number;
  readonly timedOut: boolean;
  readonly estimatedCost: number;
  readonly policyVersion: typeof QUERY_GUARDRAIL_POLICY_VERSION;
  readonly failClosed: true;
};

export type QueryTimeoutPolicy = {
  readonly queryTimeoutMs: number;
  readonly firestoreStatementTimeoutMs: number;
  readonly failClosed: true;
};

export type EvaluateSearchQueryOptions = {
  readonly limits?: Partial<QueryGuardrailLimits>;
  readonly nowMs?: number;
  readonly forExport?: boolean;
  readonly exportCount?: number;
};

const WILDCARD_ONLY_PATTERN = /^[\s*?%_]+$/;
const REGEX_LIKE_PATTERN = /^\/.*\/[gimsuy]*$/;
const PROHIBITED_INPUT_KEYS = [
  'fields',
  'select',
  'orderBy',
  'sql',
  'regex',
  'pattern',
] as const;

const FILTER_FIELD_SET = new Set<string>(searchFilterFields);
const SORT_KEY_SET = new Set<string>(searchSortKeys);

const MS_PER_DAY = 86_400_000;

function mergeLimits(partial?: Partial<QueryGuardrailLimits>): QueryGuardrailLimits {
  return { ...DEFAULT_QUERY_GUARDRAIL_LIMITS, ...partial };
}

/** NFKC normalize, trim, collapse internal whitespace. */
export function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFKC')
    // Deliberate control-character strip (C0/C1, zero-width, line/paragraph
    // separators, BOM) — this is input sanitization, not an accidental regex.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u2029\ufeff]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Lowercase normalized text for stable cache keys. */
export function canonicalizeForCacheKey(text: string): string {
  return normalizeSearchText(text).toLowerCase();
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function isGuardrailDenial(
  value: unknown,
): value is QueryGuardrailDecisionDenied {
  return (
    typeof value === 'object' &&
    value !== null &&
    'allowed' in value &&
    (value as QueryGuardrailDecisionDenied).allowed === false
  );
}

function deny(
  reason: QueryGuardrailDenialReason,
  message: string,
): QueryGuardrailDecisionDenied {
  return {
    allowed: false,
    reason,
    message,
    policyVersion: QUERY_GUARDRAIL_POLICY_VERSION,
  };
}

function allow(
  canonical: CanonicalSearchQuery,
  limits: QueryGuardrailLimits,
  cursorPosition?: string,
): QueryGuardrailDecisionAllowed {
  const queryHash = hashCanonicalQuery(canonical);
  const cacheKey = buildSearchCacheKey(canonical);
  const estimatedCost = estimateQueryCost(canonical, limits);

  return {
    allowed: true,
    canonical,
    cacheKey,
    queryHash,
    timeoutMs: limits.queryTimeoutMs,
    firestoreTimeoutMs: limits.firestoreStatementTimeoutMs,
    exportLimit: limits.maxExportResults,
    estimatedCost,
    policyVersion: QUERY_GUARDRAIL_POLICY_VERSION,
    endpointClass: SEARCH_ENDPOINT_CLASS,
    ...(cursorPosition !== undefined ? { cursorPosition } : {}),
  };
}

/** Rejects user-provided SQL, sort expressions, field selection, and regex inputs. */
export function assertNoProhibitedQueryFields(input: SearchQueryInput): QueryGuardrailDecisionDenied | null {
  for (const key of PROHIBITED_INPUT_KEYS) {
    const value = input[key as keyof SearchQueryInput];
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'sql') {
        return deny('sql_not_allowed', 'User-provided SQL is not permitted.');
      }
      if (key === 'regex' || key === 'pattern') {
        return deny('regex_not_allowed', 'Regex search patterns are not permitted.');
      }
      if (key === 'fields' || key === 'select') {
        return deny('field_selection_not_allowed', 'Arbitrary field selection is not permitted.');
      }
      if (key === 'orderBy') {
        return deny('sort_not_allowed', 'User-defined sort expressions are not permitted.');
      }
    }
  }
  return null;
}

/** Rejects wildcard-only queries that would force full scans. */
export function isWildcardOnlyQuery(normalizedQ: string): boolean {
  if (!normalizedQ) {
    return false;
  }
  return WILDCARD_ONLY_PATTERN.test(normalizedQ);
}

/** Rejects regex-like literal patterns (no regex engine is invoked). */
export function looksLikeRegexInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  return REGEX_LIKE_PATTERN.test(trimmed);
}

function parseIsoDate(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function resolveSort(raw: string | undefined, hasGeo: boolean): SearchSortKey | QueryGuardrailDecisionDenied {
  if (!raw || raw === 'relevance') {
    return hasGeo ? 'distance' : 'relevance';
  }
  if (!SORT_KEY_SET.has(raw)) {
    return deny('sort_not_allowed', `Sort key "${raw}" is not allowlisted.`);
  }
  const sort = raw as SearchSortKey;
  if (sort === 'distance' && !hasGeo) {
    return deny('sort_not_allowed', 'Distance sort requires geo parameters.');
  }
  return sort;
}

function resolveFilters(
  raw: SearchQueryInput['filters'],
  limits: QueryGuardrailLimits,
): readonly SearchFilter[] | QueryGuardrailDecisionDenied {
  if (!raw) {
    return [];
  }
  const entries = Object.entries(raw).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length > limits.maxFilters) {
    return deny('too_many_filters', `At most ${limits.maxFilters} filters are permitted.`);
  }

  const filters: SearchFilter[] = [];
  for (const [field, value] of entries) {
    if (!FILTER_FIELD_SET.has(field)) {
      return deny('filter_field_not_allowed', `Filter field "${field}" is not allowlisted.`);
    }
    const normalized = normalizeSearchText(String(value));
    if (!normalized || normalized.length > limits.maxFilterValueLength) {
      return deny('filter_value_invalid', `Filter value for "${field}" is empty or too long.`);
    }
    filters.push({ field: field as SearchFilterField, value: normalized });
  }

  filters.sort((left, right) => left.field.localeCompare(right.field));
  return filters;
}

function resolveGeo(
  input: SearchQueryInput,
  limits: QueryGuardrailLimits,
): SearchGeoInput | undefined | QueryGuardrailDecisionDenied {
  const hasLat = input.lat !== undefined;
  const hasLng = input.lng !== undefined;
  const hasRadius = input.radiusM !== undefined;

  if (!hasLat && !hasLng && !hasRadius) {
    return undefined;
  }

  if (!hasLat || !hasLng || !hasRadius) {
    return deny('geo_incomplete', 'Geo search requires lat, lng, and radiusM together.');
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const radiusM = Number(input.radiusM);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return deny('geo_incomplete', 'Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return deny('geo_incomplete', 'Longitude must be between -180 and 180.');
  }
  if (!Number.isFinite(radiusM)) {
    return deny('radius_exceeded', 'Radius must be a finite number.');
  }
  if (radiusM < limits.minRadiusM) {
    return deny('radius_too_small', `Radius must be at least ${limits.minRadiusM} meters.`);
  }
  if (radiusM > limits.maxRadiusM) {
    return deny('radius_exceeded', `Radius must not exceed ${limits.maxRadiusM} meters.`);
  }

  return { lat, lng, radiusM };
}

function resolveDateRange(
  input: SearchQueryInput,
  limits: QueryGuardrailLimits,
): SearchDateRange | undefined | QueryGuardrailDecisionDenied {
  const { dateFrom, dateTo } = input;
  if (!dateFrom && !dateTo) {
    return undefined;
  }
  if (!dateFrom || !dateTo) {
    return deny('date_range_invalid', 'Date range requires both dateFrom and dateTo.');
  }

  const fromMs = parseIsoDate(dateFrom);
  const toMs = parseIsoDate(dateTo);
  if (fromMs === null || toMs === null) {
    return deny('date_range_invalid', 'Date range values must be valid ISO-8601 timestamps.');
  }
  if (fromMs > toMs) {
    return deny('date_range_invalid', 'dateFrom must be before or equal to dateTo.');
  }

  const spanDays = (toMs - fromMs) / MS_PER_DAY;
  if (spanDays > limits.maxDateRangeDays) {
    return deny('date_range_exceeded', `Date range must not exceed ${limits.maxDateRangeDays} days.`);
  }

  return { from: dateFrom, to: dateTo };
}

function resolveShape(
  q: string,
  filters: readonly SearchFilter[],
  geo: SearchGeoInput | undefined,
): ApprovedQueryShape | QueryGuardrailDecisionDenied {
  const hasQ = q.length > 0;
  const hasFilters = filters.length > 0;
  const hasGeo = geo !== undefined;

  if (!hasQ && !hasFilters && !hasGeo) {
    return deny('empty_query', 'At least one of q, filters, or geo parameters is required.');
  }

  if (hasQ && hasFilters && hasGeo) {
    return 'text_geo_filters';
  }
  if (hasQ && hasFilters) {
    return 'text_filters';
  }
  if (hasQ && hasGeo) {
    return 'text_geo';
  }
  if (hasFilters && hasGeo) {
    return 'text_geo_filters';
  }
  if (hasFilters) {
    return 'filters_only';
  }
  if (hasGeo) {
    return 'geo_only';
  }
  return 'text';
}

function resolvePageSize(raw: number | undefined, limits: QueryGuardrailLimits): number | QueryGuardrailDecisionDenied {
  const pageSize = raw ?? limits.defaultPageSize;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return deny('page_size_exceeded', 'pageSize must be a positive integer.');
  }
  if (pageSize > limits.maxPageSize) {
    return deny('page_size_exceeded', `pageSize must not exceed ${limits.maxPageSize}.`);
  }
  return pageSize;
}

/** Deterministic cost estimate for fuzz/load budgeting not wall-clock time. */
export function estimateQueryCost(
  canonical: CanonicalSearchQuery,
  limits: QueryGuardrailLimits = DEFAULT_QUERY_GUARDRAIL_LIMITS,
): number {
  let cost = 10;
  cost += canonical.q.length;
  cost += canonical.filters.length * 25;
  cost += canonical.pageSize * 2;
  cost += canonical.depth * canonical.pageSize * 3;

  if (canonical.geo) {
    const radiusFactor = Math.ceil(canonical.geo.radiusM / 1_000);
    cost += 40 + radiusFactor * 8;
  }

  if (canonical.dateRange) {
    cost += 30;
  }

  switch (canonical.sort) {
    case 'relevance':
      cost += 20;
      break;
    case 'distance':
      cost += 35;
      break;
    default:
      cost += 15;
      break;
  }

  return Math.min(cost, limits.maxEstimatedCost);
}

export function hashCanonicalQuery(canonical: CanonicalSearchQuery): string {
  return sha256Hex(stableSerialize(canonical));
}

/** Stable cache key from canonical query (normalized lowercase text). */
export function buildSearchCacheKey(canonical: CanonicalSearchQuery): string {
  const payload = {
    q: canonicalizeForCacheKey(canonical.q),
    filters: canonical.filters.map((filter) => ({
      field: filter.field,
      value: canonicalizeForCacheKey(filter.value),
    })),
    sort: canonical.sort,
    pageSize: canonical.pageSize,
    depth: canonical.depth,
    geo: canonical.geo
      ? {
          lat: Number(canonical.geo.lat.toFixed(6)),
          lng: Number(canonical.geo.lng.toFixed(6)),
          radiusM: Math.round(canonical.geo.radiusM),
        }
      : undefined,
    dateRange: canonical.dateRange,
    shape: canonical.shape,
    v: QUERY_GUARDRAIL_POLICY_VERSION,
  };
  return `search:v1:${sha256Hex(stableSerialize(payload))}`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

/** Encodes an opaque cursor (version + query hash + depth + position). */
export function encodeSearchCursor(payload: SearchCursorPayload): string {
  if (payload.v !== 1) {
    throw new Error('Unsupported cursor version');
  }
  return encodeBase64Url(JSON.stringify(payload));
}

/** Validates cursor shape, depth cap, and query-hash binding. */
export function decodeSearchCursor(
  encoded: string,
  expectedQueryHash: string,
  limits: QueryGuardrailLimits = DEFAULT_QUERY_GUARDRAIL_LIMITS,
): SearchCursorPayload | QueryGuardrailDecisionDenied {
  const decoded = decodeBase64Url(encoded);
  if (!decoded) {
    return deny('cursor_invalid', 'Cursor is not valid base64url.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return deny('cursor_invalid', 'Cursor payload is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    return deny('cursor_invalid', 'Cursor payload must be an object.');
  }

  const record = parsed as Record<string, unknown>;
  if (record.v !== 1) {
    return deny('cursor_invalid', 'Unsupported cursor version.');
  }
  if (typeof record.depth !== 'number' || !Number.isInteger(record.depth) || record.depth < 1) {
    return deny('cursor_invalid', 'Cursor depth must be a positive integer.');
  }
  if (record.depth > limits.maxPaginationDepth) {
    return deny('pagination_depth_exceeded', `Pagination depth must not exceed ${limits.maxPaginationDepth}.`);
  }
  if (typeof record.queryHash !== 'string' || record.queryHash.length !== 64) {
    return deny('cursor_invalid', 'Cursor query hash is invalid.');
  }
  if (typeof record.position !== 'string' || !record.position || record.position.length > 256) {
    return deny('cursor_invalid', 'Cursor position is invalid.');
  }

  const expected = Buffer.from(expectedQueryHash, 'utf8');
  const actual = Buffer.from(record.queryHash, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return deny('cursor_invalid', 'Cursor does not match the current query.');
  }

  return {
    v: 1,
    depth: record.depth,
    queryHash: record.queryHash,
    position: record.position,
  };
}

export function getQueryTimeoutPolicy(
  limits: QueryGuardrailLimits = DEFAULT_QUERY_GUARDRAIL_LIMITS,
): QueryTimeoutPolicy {
  return {
    queryTimeoutMs: limits.queryTimeoutMs,
    firestoreStatementTimeoutMs: limits.firestoreStatementTimeoutMs,
    failClosed: true,
  };
}

/** Fail-closed timeout decision callers must abort work and release pool slots. */
export function createTimeoutFailure(
  queryHash: string,
  durationMs: number,
): SlowQueryLogEvent {
  return {
    event: 'slow_query',
    endpointClass: SEARCH_ENDPOINT_CLASS,
    queryHash,
    shape: 'text',
    durationMs,
    resultCount: 0,
    timedOut: true,
    estimatedCost: 0,
    policyVersion: QUERY_GUARDRAIL_POLICY_VERSION,
    failClosed: true,
  };
}

export function createSlowQueryLogEvent(input: {
  readonly queryHash: string;
  readonly shape: ApprovedQueryShape;
  readonly durationMs: number;
  readonly resultCount: number;
  readonly timedOut: boolean;
  readonly estimatedCost: number;
}): SlowQueryLogEvent {
  return {
    event: 'slow_query',
    endpointClass: SEARCH_ENDPOINT_CLASS,
    queryHash: input.queryHash,
    shape: input.shape,
    durationMs: input.durationMs,
    resultCount: input.resultCount,
    timedOut: input.timedOut,
    estimatedCost: input.estimatedCost,
    policyVersion: QUERY_GUARDRAIL_POLICY_VERSION,
    failClosed: true,
  };
}

/** Metadata for endpoint class wiring without rewriting the rate limiter. */
export function searchQueryEndpointMetadata(decision: QueryGuardrailDecisionAllowed): {
  readonly endpointClass: typeof SEARCH_ENDPOINT_CLASS;
  readonly costTier: 'expensive_read';
  readonly queryShape: ApprovedQueryShape;
  readonly queryHash: string;
  readonly estimatedCost: number;
} {
  return {
    endpointClass: decision.endpointClass,
    costTier: 'expensive_read',
    queryShape: decision.canonical.shape,
    queryHash: decision.queryHash,
    estimatedCost: decision.estimatedCost,
  };
}


/**
 * Validates and canonicalizes a public search query.
 * SQL statement timeouts for Cloud SQL remain deferred (ADR-011); Firestore budgets apply now.
 */
export function evaluateSearchQueryGuardrails(
  input: SearchQueryInput,
  options: EvaluateSearchQueryOptions = {},
): QueryGuardrailDecision {
  const limits = mergeLimits(options.limits);

  const prohibited = assertNoProhibitedQueryFields(input);
  if (prohibited) {
    return prohibited;
  }

  if (options.forExport) {
    const exportCount = options.exportCount ?? 0;
    if (exportCount > limits.maxExportResults) {
      return deny(
        'export_limit_exceeded',
        `Export requests are limited to ${limits.maxExportResults} results.`,
      );
    }
  }

  const rawQ = input.q ?? '';
  if (looksLikeRegexInput(rawQ)) {
    return deny('regex_not_allowed', 'Regex search patterns are not permitted.');
  }

  const normalizedQ = normalizeSearchText(rawQ);
  const hasOtherConstraints =
    (input.filters && Object.keys(input.filters).length > 0) ||
    input.lat !== undefined ||
    input.lng !== undefined ||
    input.radiusM !== undefined;

  if (normalizedQ.length > 0 && normalizedQ.length < limits.minQueryLength && !hasOtherConstraints) {
    return deny('query_too_short', `Query must be at least ${limits.minQueryLength} characters.`);
  }
  if (normalizedQ.length > limits.maxQueryLength) {
    return deny('query_too_long', `Query must not exceed ${limits.maxQueryLength} characters.`);
  }
  if (normalizedQ.length > 0 && isWildcardOnlyQuery(normalizedQ)) {
    return deny('wildcard_only', 'Wildcard-only queries are not permitted.');
  }

  const filtersResult = resolveFilters(input.filters, limits);
  if (isGuardrailDenial(filtersResult)) {
    return filtersResult;
  }

  const geoResult = resolveGeo(input, limits);
  if (isGuardrailDenial(geoResult)) {
    return geoResult;
  }

  const dateResult = resolveDateRange(input, limits);
  if (isGuardrailDenial(dateResult)) {
    return dateResult;
  }

  const pageSizeResult = resolvePageSize(input.pageSize, limits);
  if (isGuardrailDenial(pageSizeResult)) {
    return pageSizeResult;
  }

  const hasGeo = geoResult !== undefined;
  const sortResult = resolveSort(input.sort, hasGeo);
  if (isGuardrailDenial(sortResult)) {
    return sortResult;
  }

  const shapeResult = resolveShape(normalizedQ, filtersResult, geoResult);
  if (isGuardrailDenial(shapeResult)) {
    return shapeResult;
  }

  let depth = 1;
  let cursorPosition: string | undefined;

  if (input.cursor) {
    const provisional: CanonicalSearchQuery = {
      q: normalizedQ,
      filters: filtersResult,
      sort: sortResult,
      pageSize: pageSizeResult,
      depth: 1,
      ...(geoResult !== undefined ? { geo: geoResult } : {}),
      ...(dateResult !== undefined ? { dateRange: dateResult } : {}),
      shape: shapeResult,
    };
    const queryHash = hashCanonicalQuery(provisional);
    const cursorResult = decodeSearchCursor(input.cursor, queryHash, limits);
    if (isGuardrailDenial(cursorResult)) {
      return cursorResult;
    }
    depth = cursorResult.depth + 1;
    if (depth > limits.maxPaginationDepth) {
      return deny(
        'pagination_depth_exceeded',
        `Pagination depth must not exceed ${limits.maxPaginationDepth}.`,
      );
    }
    cursorPosition = cursorResult.position;
  }

  const canonical: CanonicalSearchQuery = {
    q: normalizedQ,
    filters: filtersResult,
    sort: sortResult,
    pageSize: pageSizeResult,
    depth,
    ...(geoResult !== undefined ? { geo: geoResult } : {}),
    ...(dateResult !== undefined ? { dateRange: dateResult } : {}),
    shape: shapeResult,
  };

  const decision = allow(canonical, limits, cursorPosition);
  const cost = estimateQueryCost(canonical, limits);
  if (cost >= limits.maxEstimatedCost) {
    return deny('prohibited_query_shape', 'Query cost exceeds allowed budget.');
  }

  return decision;
}
