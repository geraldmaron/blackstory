/**
 * Testable core of the public search endpoint, kept OUT of `route.ts` on purpose:
 * Next.js's route-file type validator rejects any export from a `route.ts` other than the HTTP
 * method handlers (`GET`, …) and route config (`runtime`), so the dependency-injectable handler and
 * its deps type live here where `route.test.ts` can import them. `route.ts` is a thin Next entry
 * that wires production singletons and delegates to `handleSearchRequest` below.
 *
 * This is the first REAL caller of `evaluateSearchQueryGuardrails`: adversarial input
 * (SQL/regex/field-selection injection, wildcard-only scans, oversize pages, forged cursors) is
 * bounded by the shared guardrail before any query runs, closing the gap where the guardrail
 * existed but had no wired caller. On allow it runs the pure `runPublicSearch` pipeline over the
 * injected search index (live release rebuild via `getPublicSearchIndex`, or the bundled snapshot
 * in tests and degraded mode).
 */
import { NextResponse } from 'next/server';
import {
  encodeSearchCursor,
  evaluateSearchQueryGuardrails,
  type SearchQueryInput,
} from '@repo/security';
import type { PublicSearchIndexDoc } from '@repo/domain';
import {
  readHybridFlagFromParams,
  readLaneKillSwitchParams,
  runWebHybridSearch,
} from '../../../lib/search/hybrid-search';
import type { SearchAppCheckGuard } from './app-check-guard';
import type { createSearchRateLimitGuard } from './rate-limit-guard';

export type SearchRouteDependencies = {
  readonly appCheckGuard: SearchAppCheckGuard;
  readonly rateLimitGuard: ReturnType<typeof createSearchRateLimitGuard>;
  readonly searchIndex: readonly PublicSearchIndexDoc[];
};

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}

function clientIpFrom(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || undefined;
}

/**
 * Parses the GET query string into a `SearchQueryInput`. Filters follow
 * `apps/api-public`'s `parsePublicSearchQuery` convention: only keys actually present are
 * included, never emitted as `undefined`. The prohibited keys (`sql`, `regex`, `pattern`,
 * `orderBy`, `fields`, `select`) are deliberately FORWARDED when present rather than dropped, so
 * the guardrail's `assertNoProhibitedQueryFields` path is exercised by the real route and returns
 * a precise denial reason (`sql_not_allowed`, `regex_not_allowed`, …) instead of a generic
 * `empty_query` — this is the security-relevant behavior the endpoint exists to prove. `lat`/`lng`/
 * `radiusM` are intentionally omitted: there is no geo search on this route.
 */
export function parseSearchQuery(params: URLSearchParams): SearchQueryInput {
  const filters: Record<string, string> = {};
  for (const field of ['kind', 'state', 'precision', 'releaseId', 'status', 'era'] as const) {
    const value = params.get(field);
    if (value !== null) filters[field] = value;
  }

  const q = params.get('q');
  const sort = params.get('sort');
  const cursor = params.get('cursor');
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  const pageSizeRaw = params.get('pageSize');
  const pageSize = pageSizeRaw !== null ? Number.parseInt(pageSizeRaw, 10) : undefined;

  // Prohibited keys forwarded (not silently stripped) so the guardrail denies them explicitly.
  const sql = params.get('sql');
  const regex = params.get('regex');
  const pattern = params.get('pattern');
  const orderBy = params.get('orderBy');
  const fields = params.get('fields');
  const select = params.get('select');

  return {
    ...(q !== null ? { q } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(sort !== null ? { sort } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(cursor !== null ? { cursor } : {}),
    ...(dateFrom !== null ? { dateFrom } : {}),
    ...(dateTo !== null ? { dateTo } : {}),
    ...(sql !== null ? { sql } : {}),
    ...(regex !== null ? { regex } : {}),
    ...(pattern !== null ? { pattern } : {}),
    ...(orderBy !== null ? { orderBy } : {}),
    ...(fields !== null ? { fields: [fields] } : {}),
    ...(select !== null ? { select: [select] } : {}),
  };
}

/**
 * Shared handler used by both the exported Next.js `GET` (production defaults) and `route.test.ts`
 * (injected fake App Check verifier, deterministic rate-limit clock, real snapshot index). Ordering
 * mirrors submit route: App Check guard → rate-limit guard → guardrails → search, with a
 * `finally` that always releases the concurrency slot.
 */
export async function handleSearchRequest(
  request: Request,
  deps: SearchRouteDependencies,
): Promise<Response> {
  const clientIp = clientIpFrom(request);

  const appCheckDecision = await deps.appCheckGuard({ headers: request.headers });
  if (!appCheckDecision.allowed) {
    return jsonError(appCheckDecision.status, 'app_check_required', {
      reason: appCheckDecision.reason,
    });
  }

  const rateDecision = deps.rateLimitGuard.evaluate({
    subject: 'anonymous',
    ...(clientIp ? { clientIp } : {}),
    appCheckVerified: appCheckDecision.verified,
  });
  if (!rateDecision.allowed) {
    const response = deps.rateLimitGuard.formatDeniedResponse(rateDecision);
    return NextResponse.json(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  try {
    const url = new URL(request.url);
    const input = parseSearchQuery(url.searchParams);

    const decision = evaluateSearchQueryGuardrails(input, {});
    if (!decision.allowed) {
      // Same shape as `apps/api-public`'s `formatSearchGuardDeniedResponse` (reimplemented locally
      // rather than imported across the app boundary).
      return jsonError(400, 'invalid_search_query', {
        reason: decision.reason,
        message: decision.message,
      });
    }

    const { canonical } = decision;
    const offset = (canonical.depth - 1) * canonical.pageSize;
    const searchInput = {
      normalizedQuery: canonical.q,
      filters: canonical.filters,
      sort: canonical.sort,
      offset,
      pageSize: canonical.pageSize,
    };

    const hybridFlag = readHybridFlagFromParams(url.searchParams);
    const laneKillSwitchParams = readLaneKillSwitchParams(url.searchParams);
    const hybridResponse = await runWebHybridSearch(searchInput, {
      searchIndex: deps.searchIndex,
      ...(hybridFlag !== null ? { hybridFlag } : {}),
      laneKillSwitchParams,
      ...(url.searchParams.get('vectorUnavailable') === '1' ? { vectorLaneUnavailable: true } : {}),
    });
    const result = hybridResponse.result;
    const retrievalTelemetry = hybridResponse.telemetry;

    // Deviation from spec step 6: the cursor embeds `depth: canonical.depth`, NOT
    // `canonical.depth + 1`. `evaluateSearchQueryGuardrails` already increments a decoded cursor's
    // depth by one (`depth = cursorResult.depth + 1` in query-guardrails.ts), so embedding
    // `canonical.depth + 1` here would double-increment and skip a page on the next request.
    // Embedding the current page's depth lets the guardrail's own +1 land on exactly the next page.
    // Verified by the cursor round-trip test. `position` is an opaque offset-string: this in-memory
    // snapshot index has no real Firestore document cursor to encode. Encoding a live Firestore
    // cursor here is the future seam that lands with the live index reader.
    let nextCursor: string | undefined;
    if (result.hasMore) {
      nextCursor = encodeSearchCursor({
        v: 1,
        depth: canonical.depth,
        queryHash: decision.queryHash,
        position: String(offset + canonical.pageSize),
      });
    }

    return NextResponse.json(
      {
        results: result.results,
        facets: result.facets,
        totalMatched: result.totalMatched,
        hasMore: result.hasMore,
        ...(nextCursor !== undefined ? { nextCursor } : {}),
        ...(retrievalTelemetry !== undefined
          ? {
              retrieval: {
                mode: retrievalTelemetry.mode,
                degraded: retrievalTelemetry.degraded,
                lanes: retrievalTelemetry.lanes,
              },
            }
          : {}),
      },
      { status: 200 },
    );
  } finally {
    deps.rateLimitGuard.release(rateDecision.key);
  }
}
