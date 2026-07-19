/**
 * Testable core of the `/explore/api` refine endpoint. Applies
 * `evaluateSearchQueryGuardrails` to the kind/era dimensions (the two filter fields that overlap
 * the allowlist), validates theme/confidence locally, then filters the bundled explore map
 * snapshot. The page itself is SSR-first this route is the progressive-enhancement seam that
 * proves App Check + guardrails on dynamic explore queries without requiring a full navigation.
 */
import { NextResponse } from 'next/server';
import { evaluateSearchQueryGuardrails, type SearchQueryInput } from '@repo/security';
import {
  applyExploreFilters,
  buildExploreFacetOptions,
  type ExploreFilterState,
} from '../../../../lib/map-experience';
import { buildExploreMapSource } from '../../../../lib/map-experience/build-explore-map-source';
import { listPublicEntityViews } from '../../../../lib/public-data/source';
import type { ExploreAppCheckGuard } from './app-check-guard';
import type { createExploreRateLimitGuard } from './rate-limit-guard';

export type ExploreRouteDependencies = {
  readonly appCheckGuard: ExploreAppCheckGuard;
  readonly rateLimitGuard: ReturnType<typeof createExploreRateLimitGuard>;
};

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}

function clientIpFrom(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || undefined;
}

const GUARDRAIL_FILTER_KEYS = ['kind', 'era'] as const;

function cleanSelectParam(raw: string | null): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

/** Validates a locally-scoped filter value (theme/confidence) bounded length, no regex/sql keys.  */
function assertLocalFilterValue(field: string, value: string): string | null {
  const normalized = value.trim();
  if (normalized === 'all') return 'all';
  if (normalized.length === 0 || normalized.length > 64) {
    return null;
  }
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized.charCodeAt(i) < 32) {
      return null;
    }
  }
  return normalized;
}

/**
 * Maps explore query params into a `SearchQueryInput` for the overlapping kind/era filters,
 * forwarding prohibited keys so the guardrail denies them explicitly (same posture as search).
 */
export function parseExploreRefineQuery(params: URLSearchParams): SearchQueryInput {
  // Always anchor to the active snapshot release so sees a filters_only shape even when
  // the caller did not pass any user-visible filters avoids empty_query on "browse all".
  const filters: Record<string, string> = { releaseId: 'seed-snapshot' };
  for (const field of GUARDRAIL_FILTER_KEYS) {
    const value = params.get(field);
    if (value !== null && cleanSelectParam(value) !== 'all') {
      filters[field] = cleanSelectParam(value);
    }
  }

  const sql = params.get('sql');
  const regex = params.get('regex');
  const pattern = params.get('pattern');
  const orderBy = params.get('orderBy');
  const fields = params.get('fields');
  const select = params.get('select');

  return {
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(sql !== null ? { sql } : {}),
    ...(regex !== null ? { regex } : {}),
    ...(pattern !== null ? { pattern } : {}),
    ...(orderBy !== null ? { orderBy } : {}),
    ...(fields !== null ? { fields: [fields] } : {}),
    ...(select !== null ? { select: [select] } : {}),
  };
}

export function parseExploreFilterState(params: URLSearchParams): ExploreFilterState | { error: string } {
  const kind = cleanSelectParam(params.get('kind'));
  const era = cleanSelectParam(params.get('era'));
  const themeRaw = cleanSelectParam(params.get('theme'));
  const confidenceRaw = cleanSelectParam(params.get('confidence'));

  const theme = assertLocalFilterValue('theme', themeRaw);
  const confidence = assertLocalFilterValue('confidence', confidenceRaw);
  if (theme === null || confidence === null) {
    return { error: 'invalid_local_filter' };
  }

  return { kind, era, theme, confidence };
}

export async function handleExploreRefineRequest(
  request: Request,
  deps: ExploreRouteDependencies,
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
    const guardInput = parseExploreRefineQuery(url.searchParams);
    const decision = evaluateSearchQueryGuardrails(guardInput, {});
    if (!decision.allowed) {
      return jsonError(400, 'invalid_explore_query', {
        reason: decision.reason,
        message: decision.message,
      });
    }

    const filterState = parseExploreFilterState(url.searchParams);
    if ('error' in filterState) {
      return jsonError(400, 'invalid_explore_query', { reason: filterState.error });
    }

    const entities = await listPublicEntityViews();
    const source = buildExploreMapSource(entities.data);
    const filtered = applyExploreFilters(source.featureCollection.features, filterState);

    return NextResponse.json(
      {
        featureIds: filtered.map((feature) => feature.properties.entityId),
        totalMatched: filtered.length,
        facets: buildExploreFacetOptions(source.featureCollection.features),
        degraded: entities.source !== 'live',
      },
      { status: 200 },
    );
  } finally {
    deps.rateLimitGuard.release(rateDecision.key);
  }
}
