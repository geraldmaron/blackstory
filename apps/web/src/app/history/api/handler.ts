/**
 * Testable core of the `/history/api` refine endpoint. Applies guardrails to
 * kind/decade filter dimensions, then filters the bundled graph release snapshot. The page itself
 * is SSR-first this route is progressive enhancement proving App Check + guardrails on dynamic
 * history queries without requiring a full navigation.
 */
import { NextResponse } from 'next/server';
import { evaluateSearchQueryGuardrails, type SearchQueryInput } from '@repo/security';
import { getHistoryGraphReleaseArtifact } from '../../../data/history-graph-seed';
import { SEED_ENTITY_RELATIONSHIPS } from '../../../data/entity-graph-seed';
import {
  buildHistoryEdges,
  buildHistoryGraphContext,
  buildHistoryNodes,
  resolveHistoryGraphSlice,
} from '../../../lib/history/build-history-graph';
import { listPublicEntityViews } from '../../../lib/public-data/source';
import type { HistoryFilterState } from '../../../lib/history/filters';
import { parseDecadeParam } from '../../../lib/history/url-state';
import type { HistoryAppCheckGuard } from './app-check-guard';
import type { createHistoryRateLimitGuard } from './rate-limit-guard';

export type HistoryRouteDependencies = {
  readonly appCheckGuard: HistoryAppCheckGuard;
  readonly rateLimitGuard: ReturnType<typeof createHistoryRateLimitGuard>;
};

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}

function clientIpFrom(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || undefined;
}

function cleanSelectParam(raw: string | null): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

export function parseHistoryRefineQuery(params: URLSearchParams): SearchQueryInput {
  const filters: Record<string, string> = { releaseId: 'seed-snapshot' };
  const kind = params.get('kind');
  const decade = params.get('decade');
  if (kind !== null && cleanSelectParam(kind) !== 'all') {
    filters.kind = cleanSelectParam(kind);
  }
  if (decade !== null && parseDecadeParam(decade)) {
    filters.era = decade;
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

export function parseHistoryFilterState(
  params: URLSearchParams,
): HistoryFilterState | { error: string } {
  const kind = cleanSelectParam(params.get('kind')) as HistoryFilterState['kind'];
  const allowed = new Set(['all', 'place', 'school', 'event', 'institution']);
  if (!allowed.has(kind)) {
    return { error: 'invalid_kind_filter' };
  }
  return { kind };
}

export async function handleHistoryRefineRequest(
  request: Request,
  deps: HistoryRouteDependencies,
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
    const guardInput = parseHistoryRefineQuery(url.searchParams);
    const decision = evaluateSearchQueryGuardrails(guardInput, {});
    if (!decision.allowed) {
      return jsonError(400, 'invalid_history_query', {
        reason: decision.reason,
        message: decision.message,
      });
    }

    const filterState = parseHistoryFilterState(url.searchParams);
    if ('error' in filterState) {
      return jsonError(400, 'invalid_history_query', { reason: filterState.error });
    }

    const decade = parseDecadeParam(url.searchParams.get('decade') ?? undefined);
    const { data: entities } = await listPublicEntityViews();
    const artifact = getHistoryGraphReleaseArtifact(entities);
    const context = buildHistoryGraphContext(artifact, entities);
    const slice = resolveHistoryGraphSlice(artifact, decade ? 'decade' : 'all-time', decade);
    const nodes = buildHistoryNodes(slice, filterState, context.entitiesById);
    const visibleNodeIds = new Set(nodes.map((node) => node.entityId));
    const edges = buildHistoryEdges(
      slice,
      SEED_ENTITY_RELATIONSHIPS,
      context.entitiesById,
      visibleNodeIds,
    );

    return NextResponse.json(
      {
        nodeIds: nodes.map((node) => node.entityId),
        edgeIds: edges.map((edge) => edge.edgeId),
        totalMatched: nodes.length,
        sparseDecade: slice.sparseDecade,
        facets: context.facetOptions,
        degraded: false,
      },
      { status: 200 },
    );
  } finally {
    deps.rateLimitGuard.release(rateDecision.key);
  }
}
