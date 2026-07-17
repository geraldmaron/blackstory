/**
 * Hybrid retrieval orchestration (BB-072): parallel lanes, RRF fusion, deterministic re-rank,
 * fallback ladder, and degraded telemetry. Numeric fusion scores and vector distances stay
 * internal — public payloads carry only human-readable explanations.
 */
import { applyFilters, computeFacetCounts } from './facets.js';
import { fuseHybridLanes, type FusionWeights } from './fusion.js';
import { buildWhyThisResult, assertHybridExplanationHasNoNumericScore } from './hybrid-explain.js';
import {
  DEFAULT_LANE_KILL_SWITCHES,
  DEFAULT_LANE_LIMITS,
  deriveVectorEraPreFilter,
  eraBucketOverlapsRecord,
  runParallelLanes,
  type LaneKillSwitches,
  type LaneRuntimeStatus,
  type LaneStatusMap,
  type VectorLaneQueryPort,
} from './lanes.js';
import { rankRecords, type RankedRecord } from './ranking.js';
import type {
  PublicSearchIndexDoc,
  SearchExecutionInput,
  SearchExecutionResult,
  SearchFilter,
  SearchResultView,
} from './types.js';

export type HybridRetrievalMode = 'hybrid' | 'structured_only' | 'snapshot_browse';

export type HybridRetrievalTelemetry = {
  readonly mode: HybridRetrievalMode;
  readonly degraded: boolean;
  readonly lanes: LaneStatusMap;
  readonly fusionWeightsVersion?: string;
  readonly eraPreFilter?: string;
};

export type HybridSearchOptions = {
  readonly hybridEnabled?: boolean;
  readonly killSwitches?: LaneKillSwitches;
  readonly fusionWeights?: FusionWeights;
  readonly vectorPort?: VectorLaneQueryPort;
  readonly placeAnchored?: boolean;
};

export type HybridSearchResultView = SearchResultView & {
  readonly whyThisResult: readonly string[];
};

export type HybridSearchExecutionResult = Omit<SearchExecutionResult, 'results'> & {
  readonly results: readonly HybridSearchResultView[];
  readonly telemetry: HybridRetrievalTelemetry;
};

const RESEARCH_COVERAGE_TIER: Readonly<Record<string, number>> = {
  substantial: 2,
  partial: 1,
  minimal: 0,
};

function researchCoverageTier(record: PublicSearchIndexDoc): number {
  return RESEARCH_COVERAGE_TIER[record.researchCoverage] ?? 0;
}

function isPlaceAnchored(input: SearchExecutionInput, explicit?: boolean): boolean {
  if (explicit === true) return true;
  return input.filters.some((f) => f.field === 'state');
}

function resolveMode(
  structuredStatus: LaneRuntimeStatus,
  vectorStatus: LaneRuntimeStatus,
  hybridEnabled: boolean,
): HybridRetrievalMode {
  if (!hybridEnabled) return 'structured_only';
  const structuredOk = structuredStatus === 'ok';
  const vectorOk = vectorStatus === 'ok';
  if (structuredOk && vectorOk) return 'hybrid';
  if (structuredOk) return 'structured_only';
  return 'snapshot_browse';
}

function structuredRankMap(ranked: readonly RankedRecord[]): Map<string, RankedRecord> {
  return new Map(ranked.map((entry) => [entry.record.id, entry]));
}

type RerankEntry = {
  readonly record: PublicSearchIndexDoc;
  readonly ranked?: RankedRecord;
  readonly fusionIndex: number;
  readonly fromVector: boolean;
};

/**
 * Deterministic re-rank on the fused list (BB-040 principles):
 *  - text relevance tier (structured match strength) over connection strength
 *  - era overlap boost when era filter/pre-filter is active
 *  - geographic proximity when query is place-anchored
 *  - researchCoverage as confidence tiebreaker (never a filter)
 *  - id ascending final tie-break
 */
export function deterministicHybridRerank(
  fusedIds: readonly string[],
  indexById: ReadonlyMap<string, PublicSearchIndexDoc>,
  structuredRanked: readonly RankedRecord[],
  structuredById: ReadonlyMap<string, RankedRecord>,
  vectorIds: ReadonlySet<string>,
  input: SearchExecutionInput,
  eraPreFilter: string | undefined,
  placeAnchored: boolean,
): readonly RerankEntry[] {
  const eraFilter = input.filters.find((f) => f.field === 'era')?.value;
  const eraHint = eraFilter ?? eraPreFilter;

  const structuredOrder = new Map(structuredRanked.map((entry, index) => [entry.record.id, index]));

  const entries: RerankEntry[] = [];
  for (let fusionIndex = 0; fusionIndex < fusedIds.length; fusionIndex += 1) {
    const id = fusedIds[fusionIndex]!;
    const record = indexById.get(id);
    if (!record) continue;
    const ranked = structuredById.get(id);
    entries.push({
      record,
      fusionIndex,
      fromVector: vectorIds.has(id),
      ...(ranked !== undefined ? { ranked } : {}),
    });
  }

  const textTier = (entry: RerankEntry): number => {
    if (entry.ranked) {
      const idx = structuredOrder.get(entry.record.id);
      return idx === undefined ? 0 : 1000 - idx;
    }
    return entry.fromVector ? 15 : 0;
  };

  const eraBoost = (entry: RerankEntry): number =>
    eraHint && eraBucketOverlapsRecord(eraHint, entry.record.eraBuckets) ? 1 : 0;

  const placeBoost = (entry: RerankEntry): number => {
    if (!placeAnchored) return 0;
    const stateFilter = input.filters.find((f) => f.field === 'state')?.value;
    if (stateFilter && entry.record.jurisdictionState === stateFilter) return 1;
    return entry.record.jurisdictionState ? 0 : 0;
  };

  entries.sort((a, b) => {
    const tierDiff = textTier(b) - textTier(a);
    if (tierDiff !== 0) return tierDiff;

    const eraDiff = eraBoost(b) - eraBoost(a);
    if (eraDiff !== 0) return eraDiff;

    const placeDiff = placeBoost(b) - placeBoost(a);
    if (placeDiff !== 0) return placeDiff;

    if (a.fusionIndex !== b.fusionIndex) return a.fusionIndex - b.fusionIndex;

    if (a.record.relatedCount !== b.record.relatedCount) {
      return b.record.relatedCount - a.record.relatedCount;
    }

    const coverageDiff = researchCoverageTier(b.record) - researchCoverageTier(a.record);
    if (coverageDiff !== 0) return coverageDiff;

    return a.record.id.localeCompare(b.record.id);
  });

  return entries;
}

function toHybridResultView(
  entry: RerankEntry,
  query: string,
  context: {
    readonly eraFilter?: string;
    readonly eraPreFilter?: string;
    readonly placeAnchored: boolean;
  },
): HybridSearchResultView {
  const { record, ranked, fromVector } = entry;
  const matchedOn = ranked?.matchedOn ?? (fromVector ? 'summary' : 'displayName');
  const matchedText = ranked?.matchedText ?? record.displayName;

  const whyThisResult = buildWhyThisResult(record, ranked, query, {
    fromStructuredLane: ranked !== undefined,
    fromVectorLane: fromVector,
    placeAnchored: context.placeAnchored,
    ...(context.eraFilter !== undefined ? { eraFilter: context.eraFilter } : {}),
    ...(context.eraPreFilter !== undefined ? { eraPreFilter: context.eraPreFilter } : {}),
  });
  assertHybridExplanationHasNoNumericScore(whyThisResult);

  const explanation = whyThisResult[0] ?? 'Matched your search.';

  return {
    id: record.id,
    kind: record.kind,
    displayName: record.displayName,
    ...(record.summary !== undefined ? { summary: record.summary } : {}),
    matchedOn,
    matchedText,
    explanation,
    whyThisResult,
    ...(record.status !== undefined ? { status: record.status } : {}),
    eraBuckets: record.eraBuckets,
    notabilityLabels: record.notabilityLabels,
    ...(record.sensitivityClass !== undefined ? { sensitivityClass: record.sensitivityClass } : {}),
  };
}

/** Strips internal telemetry before serializing a public HTTP response. */
export function toPublicHybridSearchPayload(
  result: HybridSearchExecutionResult,
): SearchExecutionResult {
  return {
    results: result.results.map(({ whyThisResult: _why, ...view }) => view),
    facets: result.facets,
    totalMatched: result.totalMatched,
    hasMore: result.hasMore,
  };
}

/**
 * Executes hybrid search: parallel lanes -> RRF fusion -> deterministic re-rank -> paginate.
 * Falls back to structured-only when the vector lane is down; to snapshot browse when both fail.
 */
export async function runHybridSearch(
  input: SearchExecutionInput,
  index: readonly PublicSearchIndexDoc[],
  options: HybridSearchOptions = {},
): Promise<HybridSearchExecutionResult> {
  const hybridEnabled = options.hybridEnabled ?? false;
  const killSwitches = options.killSwitches ?? DEFAULT_LANE_KILL_SWITCHES;
  const placeAnchored = isPlaceAnchored(input, options.placeAnchored);

  const filtered = applyFilters(index, input.filters);
  const facets = computeFacetCounts(filtered);
  const indexById = new Map(filtered.map((doc) => [doc.id, doc]));

  const laneOutput = await runParallelLanes(
    {
      normalizedQuery: input.normalizedQuery,
      filters: input.filters,
      structuredLimit: DEFAULT_LANE_LIMITS.structured,
      vectorLimit: DEFAULT_LANE_LIMITS.vector,
    },
    index,
    killSwitches,
    options.vectorPort,
  );

  const mode = resolveMode(laneOutput.structured.status, laneOutput.vector.status, hybridEnabled);
  const degraded =
    hybridEnabled &&
    mode !== 'hybrid' &&
    (laneOutput.vector.status === 'unavailable' ||
      laneOutput.vector.status === 'failed' ||
      laneOutput.vector.status === 'disabled');

  let fusedIds: readonly string[] = [];
  let fusionWeightsVersion: string | undefined;

  if (mode === 'hybrid') {
    const fusion = fuseHybridLanes({
      structuredRanked: laneOutput.structured.ranked,
      vectorMatches: laneOutput.vector.matches,
      ...(options.fusionWeights !== undefined ? { weights: options.fusionWeights } : {}),
    });
    fusedIds = fusion.fusedIds;
    fusionWeightsVersion = fusion.weightsVersion;
  } else if (mode === 'structured_only') {
    fusedIds = laneOutput.structured.ranked.map((entry) => entry.record.id);
  } else {
    const browseRanked = rankRecords('', filtered);
    fusedIds = browseRanked.map((entry) => entry.record.id);
  }

  const structuredById = structuredRankMap(laneOutput.structured.ranked);
  const vectorIds = new Set(laneOutput.vector.matches.map((m) => m.entityId));

  const reranked = deterministicHybridRerank(
    fusedIds,
    indexById,
    laneOutput.structured.ranked,
    structuredById,
    vectorIds,
    input,
    laneOutput.eraPreFilter,
    placeAnchored,
  );

  const totalMatched = reranked.length;
  const page = reranked.slice(input.offset, input.offset + input.pageSize);

  const eraFilter = input.filters.find((f) => f.field === 'era')?.value;
  const results = page.map((entry) =>
    toHybridResultView(entry, input.normalizedQuery, {
      placeAnchored,
      ...(eraFilter !== undefined ? { eraFilter } : {}),
      ...(laneOutput.eraPreFilter !== undefined ? { eraPreFilter: laneOutput.eraPreFilter } : {}),
    }),
  );

  return {
    results,
    facets,
    totalMatched,
    hasMore: input.offset + input.pageSize < totalMatched,
    telemetry: {
      mode,
      degraded,
      lanes: {
        structured: laneOutput.structured.status,
        vector: laneOutput.vector.status,
      },
      ...(fusionWeightsVersion !== undefined ? { fusionWeightsVersion } : {}),
      ...(laneOutput.eraPreFilter !== undefined ? { eraPreFilter: laneOutput.eraPreFilter } : {}),
    },
  };
}

/** Returns true when hybrid mode should activate for a request (feature flag + non-empty query). */
export function shouldUseHybridSearch(input: {
  readonly hybridFlag?: string | boolean;
  readonly normalizedQuery: string;
}): boolean {
  const flag =
    input.hybridFlag === true ||
    input.hybridFlag === '1' ||
    input.hybridFlag === 'true';
  return flag && input.normalizedQuery.trim().length > 0;
}

/** Parses per-lane kill switch overrides from query params (BB-035 pattern). */
export function parseLaneKillSwitches(params: {
  readonly structured?: string;
  readonly vector?: string;
}): Partial<LaneKillSwitches> {
  const parse = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    if (value === '0' || value === 'false') return false;
    if (value === '1' || value === 'true') return true;
    return undefined;
  };
  const structured = parse(params.structured);
  const vector = parse(params.vector);
  return {
    ...(structured !== undefined ? { structuredEnabled: structured } : {}),
    ...(vector !== undefined ? { vectorEnabled: vector } : {}),
  };
}

export function mergeLaneKillSwitches(
  overrides: Partial<LaneKillSwitches>,
  base: LaneKillSwitches = DEFAULT_LANE_KILL_SWITCHES,
): LaneKillSwitches {
  return {
    structuredEnabled: overrides.structuredEnabled ?? base.structuredEnabled,
    vectorEnabled: overrides.vectorEnabled ?? base.vectorEnabled,
  };
}
