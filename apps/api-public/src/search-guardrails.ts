/**
 * Public API search guardrails HTTP query parsing + validation.
 * Composes with rate limits via shared endpoint class metadata.
 */
import {
  evaluateSearchQueryGuardrails,
  formatRateLimitResponse,
  searchQueryEndpointMetadata,
  type QueryGuardrailDecision,
  type QueryGuardrailDecisionDenied,
  type SearchQueryInput,
} from '@repo/security';

export type PublicSearchHttpQuery = {
  readonly q?: string;
  readonly kind?: string;
  readonly state?: string;
  readonly precision?: string;
  readonly releaseId?: string;
  readonly sort?: string;
  readonly pageSize?: string;
  readonly cursor?: string;
  readonly lat?: string;
  readonly lng?: string;
  readonly radiusM?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  // Prohibited query shapes (SQL/regex/field-selection injection vectors). These are NOT dropped
  // silently — they are forwarded into the guardrail so `assertNoProhibitedQueryFields` denies them
  // with a precise reason (`sql_not_allowed`, …) rather than the request being treated as its safe
  // base query. Mirrors `apps/web`'s search handler rationale.
  readonly sql?: string;
  readonly regex?: string;
  readonly pattern?: string;
  readonly orderBy?: string;
  readonly fields?: string;
  readonly select?: string;
};

export type PublicSearchGuardRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: PublicSearchHttpQuery;
  readonly forExport?: boolean;
  readonly exportCount?: number;
};

export type PublicSearchGuardDecision = QueryGuardrailDecision & {
  readonly path: string;
  readonly endpointClass: 'search';
};

export type PublicSearchGuardDeniedResponse = {
  readonly status: 400;
  readonly body: {
    readonly error: 'invalid_search_query';
    readonly reason: QueryGuardrailDecisionDenied['reason'];
    readonly message: string;
  };
};

const SEARCH_PATH = /^\/v1\/search(?:\/|$)/i;

/** Parses allowlisted query-string params into SearchQueryInput.  */
export function parsePublicSearchQuery(raw: PublicSearchHttpQuery): SearchQueryInput {
  const filters: Record<string, string> = {};
  if (raw.kind !== undefined) {
    filters.kind = raw.kind;
  }
  if (raw.state !== undefined) {
    filters.state = raw.state;
  }
  if (raw.precision !== undefined) {
    filters.precision = raw.precision;
  }
  if (raw.releaseId !== undefined) {
    filters.releaseId = raw.releaseId;
  }

  const pageSize = raw.pageSize !== undefined ? parseOptionalInt(raw.pageSize) : undefined;
  const lat = raw.lat !== undefined ? parseOptionalFloat(raw.lat) : undefined;
  const lng = raw.lng !== undefined ? parseOptionalFloat(raw.lng) : undefined;
  const radiusM = raw.radiusM !== undefined ? parseOptionalFloat(raw.radiusM) : undefined;

  return {
    ...(raw.q !== undefined ? { q: raw.q } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(raw.sort !== undefined ? { sort: raw.sort } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(raw.cursor !== undefined ? { cursor: raw.cursor } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    ...(radiusM !== undefined ? { radiusM } : {}),
    ...(raw.dateFrom !== undefined ? { dateFrom: raw.dateFrom } : {}),
    ...(raw.dateTo !== undefined ? { dateTo: raw.dateTo } : {}),
    // Prohibited keys forwarded (not stripped) so the guardrail denies them explicitly.
    ...(raw.sql !== undefined ? { sql: raw.sql } : {}),
    ...(raw.regex !== undefined ? { regex: raw.regex } : {}),
    ...(raw.pattern !== undefined ? { pattern: raw.pattern } : {}),
    ...(raw.orderBy !== undefined ? { orderBy: raw.orderBy } : {}),
    ...(raw.fields !== undefined ? { fields: [raw.fields] } : {}),
    ...(raw.select !== undefined ? { select: [raw.select] } : {}),
  };
}

function parseOptionalInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalFloat(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isPublicSearchPath(path: string, method: string): boolean {
  const normalized = path.split('?')[0] ?? path;
  return method.toUpperCase() === 'GET' && SEARCH_PATH.test(normalized);
}

export function formatSearchGuardDeniedResponse(
  decision: QueryGuardrailDecisionDenied,
): PublicSearchGuardDeniedResponse {
  return {
    status: 400,
    body: {
      error: 'invalid_search_query',
      reason: decision.reason,
      message: decision.message,
    },
  };
}

export function createPublicSearchGuard() {
  return {
    evaluate(request: PublicSearchGuardRequest): PublicSearchGuardDecision | null {
      if (!isPublicSearchPath(request.path, request.method)) {
        return null;
      }

      const input = parsePublicSearchQuery(request.query);
      const decision = evaluateSearchQueryGuardrails(input, {
        ...(request.forExport !== undefined ? { forExport: request.forExport } : {}),
        ...(request.exportCount !== undefined ? { exportCount: request.exportCount } : {}),
      });

      return { ...decision, path: request.path, endpointClass: 'search' };
    },

    endpointMetadata(decision: Extract<QueryGuardrailDecision, { allowed: true }>) {
      return searchQueryEndpointMetadata(decision);
    },

    formatDeniedResponse(decision: QueryGuardrailDecisionDenied) {
      return formatSearchGuardDeniedResponse(decision);
    },

    /** Re-export for middleware that chains denial formatting.  */
    formatRateLimitDenied(decision: Parameters<typeof formatRateLimitResponse>[0]) {
      return formatRateLimitResponse(decision);
    },
  };
}
