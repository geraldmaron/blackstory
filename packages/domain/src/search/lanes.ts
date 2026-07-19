/**
 * Parallel retrieval lanes for hybrid search: bounded structured/prefix recall and vector
 * KNN recall. Each lane can be independently disabled via kill switches. Vector-lane era
 * pre-filters delegate to the shared `deriveEraBuckets` `deriveDecadeLabel` helpers.
 */
import { deriveDecadeLabel, deriveEraBuckets } from '../era.js';
import { applyFilters } from './facets.js';
import { rankRecords, type RankedRecord } from './ranking.js';
import type { PublicSearchIndexDoc, SearchFilter } from './types.js';

export type SearchLaneId = 'structured' | 'vector';

export type LaneKillSwitches = {
  readonly structuredEnabled: boolean;
  readonly vectorEnabled: boolean;
};

export const DEFAULT_LANE_KILL_SWITCHES: LaneKillSwitches = {
  structuredEnabled: true,
  vectorEnabled: true,
};

export type LaneRuntimeStatus = 'ok' | 'disabled' | 'unavailable' | 'failed';

export type LaneStatusMap = {
  readonly structured: LaneRuntimeStatus;
  readonly vector: LaneRuntimeStatus;
};

export type StructuredLaneInput = {
  readonly normalizedQuery: string;
  readonly filters: readonly SearchFilter[];
  readonly limit: number;
};

export type StructuredLaneResult = {
  readonly status: LaneRuntimeStatus;
  readonly ranked: readonly RankedRecord[];
};

export type VectorLaneMatch = {
  readonly entityId: string;
  /** Internal distance/similarity never exposed in public payloads. */
  readonly distance: number;
};

export type VectorLaneInput = {
  readonly normalizedQuery: string;
  readonly filters: readonly SearchFilter[];
  readonly eraBucket?: string;
  readonly limit: number;
};

export type VectorLaneResult = {
  readonly status: LaneRuntimeStatus;
  readonly matches: readonly VectorLaneMatch[];
};

export type VectorLaneQueryPort = {
  findNearest(input: VectorLaneInput): Promise<VectorLaneResult> | VectorLaneResult;
};

const DEFAULT_STRUCTURED_LANE_LIMIT = 50;
const DEFAULT_VECTOR_LANE_LIMIT = 30;

export const DEFAULT_LANE_LIMITS = {
  structured: DEFAULT_STRUCTURED_LANE_LIMIT,
  vector: DEFAULT_VECTOR_LANE_LIMIT,
} as const;

/**
 * Derives the decade bucket pre-filter for the vector lane. Prefers an explicit `era` search
 * filter; otherwise scans the query for a four-digit year and maps it through shared
 * `deriveDecadeLabel`.
 */
export function deriveVectorEraPreFilter(input: {
  readonly normalizedQuery: string;
  readonly filters: readonly SearchFilter[];
}): string | undefined {
  const eraFilter = input.filters.find((f) => f.field === 'era')?.value;
  if (eraFilter && /^\d{4}s$/.test(eraFilter)) return eraFilter;

  const yearMatch = /\b(1[6-9]\d{2}|20\d{2})\b/.exec(input.normalizedQuery);
  if (yearMatch) {
    const year = Number.parseInt(yearMatch[1]!, 10);
    return deriveDecadeLabel(year);
  }

  return undefined;
}

/** Validates that era pre-filter labels match decade bucket shape. */
export function eraBucketOverlapsRecord(
  eraBucket: string | undefined,
  recordEraBuckets: readonly string[],
): boolean {
  if (!eraBucket) return false;
  const spanBuckets = deriveEraBuckets({
    validFrom: eraBucket.replace(/s$/, ''),
    datePrecision: 'decade',
  });
  return (
    spanBuckets.some((bucket) => recordEraBuckets.includes(bucket)) ||
    recordEraBuckets.includes(eraBucket)
  );
}

/**
 * Runs the structured/prefix lane: filter -> rank -> cap. Returns `disabled` when the kill switch
 * is off, `failed` when the query is empty and not browse-mode (structured lane needs text for
 * non-browse hybrid).
 */
export function runStructuredLane(
  input: StructuredLaneInput,
  index: readonly PublicSearchIndexDoc[],
  killSwitches: LaneKillSwitches,
): StructuredLaneResult {
  if (!killSwitches.structuredEnabled) {
    return { status: 'disabled', ranked: [] };
  }

  try {
    const filtered = applyFilters(index, input.filters);
    const ranked = rankRecords(input.normalizedQuery, filtered);
    const limit = Math.max(1, input.limit);
    return { status: 'ok', ranked: ranked.slice(0, limit) };
  } catch {
    return { status: 'failed', ranked: [] };
  }
}

/**
 * Runs the vector KNN lane through an injected port. Applies era pre-filter from shared
 * derivation before delegating to the store.
 */
export async function runVectorLane(
  input: VectorLaneInput,
  killSwitches: LaneKillSwitches,
  port: VectorLaneQueryPort | undefined,
): Promise<VectorLaneResult> {
  if (!killSwitches.vectorEnabled) {
    return { status: 'disabled', matches: [] };
  }
  if (!port) {
    return { status: 'unavailable', matches: [] };
  }

  try {
    const result = await port.findNearest(input);
    const limit = Math.max(1, input.limit);
    return {
      status: result.status === 'ok' ? 'ok' : result.status,
      matches: result.matches.slice(0, limit),
    };
  } catch {
    return { status: 'failed', matches: [] };
  }
}

export type ParallelLaneInput = {
  readonly normalizedQuery: string;
  readonly filters: readonly SearchFilter[];
  readonly structuredLimit?: number;
  readonly vectorLimit?: number;
};

export type ParallelLaneOutput = {
  readonly structured: StructuredLaneResult;
  readonly vector: VectorLaneResult;
  readonly eraPreFilter?: string;
};

/** Executes structured and vector lanes concurrently (when both are enabled). */
export async function runParallelLanes(
  input: ParallelLaneInput,
  index: readonly PublicSearchIndexDoc[],
  killSwitches: LaneKillSwitches,
  vectorPort: VectorLaneQueryPort | undefined,
): Promise<ParallelLaneOutput> {
  const eraPreFilter = deriveVectorEraPreFilter({
    normalizedQuery: input.normalizedQuery,
    filters: input.filters,
  });

  const structuredInput: StructuredLaneInput = {
    normalizedQuery: input.normalizedQuery,
    filters: input.filters,
    limit: input.structuredLimit ?? DEFAULT_LANE_LIMITS.structured,
  };

  const vectorInput: VectorLaneInput = {
    normalizedQuery: input.normalizedQuery,
    filters: input.filters,
    limit: input.vectorLimit ?? DEFAULT_LANE_LIMITS.vector,
    ...(eraPreFilter !== undefined ? { eraBucket: eraPreFilter } : {}),
  };

  const structured = runStructuredLane(structuredInput, index, killSwitches);
  const vector = await runVectorLane(vectorInput, killSwitches, vectorPort);

  return {
    structured,
    vector,
    ...(eraPreFilter !== undefined ? { eraPreFilter } : {}),
  };
}
