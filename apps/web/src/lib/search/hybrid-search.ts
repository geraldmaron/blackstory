/**
 * Hybrid search wiring for the public web app.
 *
 * Composes domain hybrid retrieval over the snapshot index + in-memory vector lane. Telemetry
 * stays server-side; HTTP responses use `toPublicHybridSearchPayload`.
 */
import {
  mergeLaneKillSwitches,
  parseLaneKillSwitches,
  runHybridSearch,
  shouldUseHybridSearch,
  toPublicHybridSearchPayload,
  type HybridSearchExecutionResult,
  type LaneKillSwitches,
  type PublicSearchIndexDoc,
  type SearchExecutionInput,
  type SearchExecutionResult,
} from '@black-book/domain';
import { getSnapshotSearchIndex } from './snapshot-search-index';
import { createSnapshotVectorLane } from './snapshot-vector-lane';

export type HybridSearchRequestOptions = {
  readonly hybridFlag?: string | boolean;
  readonly laneKillSwitchParams?: {
    readonly structured?: string;
    readonly vector?: string;
  };
  readonly vectorLaneUnavailable?: boolean;
  readonly searchIndex?: readonly PublicSearchIndexDoc[];
};

export type HybridSearchResponse = {
  readonly result: SearchExecutionResult;
  readonly telemetry?: HybridSearchExecutionResult['telemetry'];
};

/**
 * Runs public search, optionally through hybrid fusion when `hybrid=1` is present and the query
 * is non-empty.
 */
export async function runWebHybridSearch(
  input: SearchExecutionInput,
  options: HybridSearchRequestOptions = {},
): Promise<HybridSearchResponse> {
  const index = options.searchIndex ?? getSnapshotSearchIndex();
  const useHybrid = shouldUseHybridSearch({
    normalizedQuery: input.normalizedQuery,
    ...(options.hybridFlag !== undefined ? { hybridFlag: options.hybridFlag } : {}),
  });

  if (!useHybrid) {
    const { runPublicSearch } = await import('@black-book/domain');
    return { result: runPublicSearch(input, index) };
  }

  const killSwitchOverrides = parseLaneKillSwitches(options.laneKillSwitchParams ?? {});
  const killSwitches: LaneKillSwitches = mergeLaneKillSwitches(killSwitchOverrides);

  const hybridResult = await runHybridSearch(input, index, {
    hybridEnabled: true,
    killSwitches,
    vectorPort: createSnapshotVectorLane(index, {
      ...(options.vectorLaneUnavailable ? { unavailable: true } : {}),
    }),
  });

  return {
    result: toPublicHybridSearchPayload(hybridResult),
    telemetry: hybridResult.telemetry,
  };
}

/** Reads hybrid feature flag from URL search params.  */
export function readHybridFlagFromParams(params: URLSearchParams): string | null {
  return params.get('hybrid');
}

/** Reads per-lane kill switch overrides from URL search params.  */
export function readLaneKillSwitchParams(params: URLSearchParams): {
  readonly structured?: string;
  readonly vector?: string;
} {
  const structured = params.get('laneStructured');
  const vector = params.get('laneVector');
  return {
    ...(structured !== null ? { structured } : {}),
    ...(vector !== null ? { vector } : {}),
  };
}
