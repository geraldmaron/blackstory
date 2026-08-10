/**
 * Server-side readers for stored release graph artifacts in bb_public.release_graph_*.
 */
import type { GraphReleaseArtifact } from '@repo/domain';
import {
  graphReleaseArtifactFromStored,
  parseStoredAllTimeView,
  parseStoredDecadeView,
  type StoredGraphAdjacencyRow,
} from '@repo/domain';
import { queryPostgres } from './postgres-client';
import {
  createLiveCatalogMemoryCache,
  createSingleFlight,
  liveCatalogCacheKey,
} from './live-catalog-cache';

/**
 * Matches `RELEASE_CATALOG_REVALIDATE_SECONDS` in `./source.ts`. Same reasoning: the graph
 * tables are upserted in place by `packages/ops-data/scripts` under an unchanged release id,
 * so this TTL is a freshness bound on editorial corrections, not merely a memory bound.
 */
const GRAPH_RELEASE_TTL_MS = 30 * 60 * 1000;

/**
 * Before this cache, `fetchStoredGraphReleaseArtifact` pulled three full tables from Postgres
 * on *every* call with no TTL and no dedupe: `release_graph_adjacency` (~656KB / 4,092 rows),
 * `release_graph_decades` (~339KB) and `release_graph_all_time` (~61KB), so ~1MB per invocation.
 * Over the 20 days to 2026-08-09 that was 9,347 calls and 38.2M adjacency rows (~6.3GB egress).
 *
 * Structurally this was the same defect as the `release_entities` catalog pull that produced
 * ~253GB of egress, just two orders of magnitude smaller — an unbounded per-instance full-table
 * read behind no cache. It gets the same treatment: release-keyed process memory plus
 * single-flight so a cold instance under concurrent load issues one pull, not N.
 */
const graphArtifactMemory = createLiveCatalogMemoryCache<GraphReleaseArtifact>({
  defaultTtlMs: GRAPH_RELEASE_TTL_MS,
});
const graphSingleFlight = createSingleFlight();

/** Test seam: drop memoized graph artifacts between cases. */
export function __resetGraphReleaseCacheForTests(): void {
  graphArtifactMemory.clear();
}

type GraphAdjacencyRow = {
  readonly entity_id: string;
  readonly adjacency: unknown;
};

type GraphDecadeRow = {
  readonly decade: number;
  readonly payload: unknown;
};

type GraphAllTimeRow = {
  readonly payload: unknown;
};

function parseAdjacencyRow(row: GraphAdjacencyRow): StoredGraphAdjacencyRow | undefined {
  const payload = row.adjacency;
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const entries = Array.isArray(record.entries) ? record.entries : [];
  const totalCandidates =
    typeof record.totalCandidates === 'number' ? record.totalCandidates : entries.length;
  return {
    entityId: row.entity_id,
    totalCandidates,
    entries,
  };
}

function decadeLabelFromInteger(decade: number): string {
  return `${decade}s`;
}

/**
 * Returns a stored graph release artifact when all three tables are populated, memoized per
 * release for `GRAPH_RELEASE_TTL_MS` with concurrent misses collapsed onto one load.
 *
 * A miss is deliberately not memoized: the negative case costs one indexed empty result on
 * `release_graph_adjacency` rather than the ~1MB three-table read, and caching it would hide a
 * freshly published graph for up to the full TTL.
 */
export async function fetchStoredGraphReleaseArtifact(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
}): Promise<GraphReleaseArtifact | undefined> {
  const cacheKey = liveCatalogCacheKey('graph', input.releaseId, input.generatedAt);
  const cached = graphArtifactMemory.get(cacheKey);
  if (cached !== undefined) return cached;

  return graphSingleFlight(cacheKey, async () => {
    const raced = graphArtifactMemory.get(cacheKey);
    if (raced !== undefined) return raced;
    const loaded = await loadStoredGraphReleaseArtifact(input);
    if (loaded !== undefined) {
      graphArtifactMemory.set(cacheKey, loaded);
    }
    return loaded;
  });
}

async function loadStoredGraphReleaseArtifact(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
}): Promise<GraphReleaseArtifact | undefined> {
  const adjacencyRows = await queryPostgres<GraphAdjacencyRow>(
    `SELECT entity_id, adjacency
     FROM bb_public.release_graph_adjacency
     WHERE release_id = $1
     ORDER BY entity_id`,
    [input.releaseId],
  );
  if (adjacencyRows.length === 0) return undefined;

  const decadeRows = await queryPostgres<GraphDecadeRow>(
    `SELECT decade, payload
     FROM bb_public.release_graph_decades
     WHERE release_id = $1
     ORDER BY decade`,
    [input.releaseId],
  );

  const allTimeRows = await queryPostgres<GraphAllTimeRow>(
    `SELECT payload
     FROM bb_public.release_graph_all_time
     WHERE release_id = $1
     LIMIT 1`,
    [input.releaseId],
  );
  const allTimePayload = allTimeRows[0]?.payload;
  const allTimeView = parseStoredAllTimeView(allTimePayload);
  if (!allTimeView) return undefined;

  const parsedAdjacency = adjacencyRows
    .map(parseAdjacencyRow)
    .filter((row): row is StoredGraphAdjacencyRow => row !== undefined);

  const parsedDecades = decadeRows
    .map((row) => {
      const view = parseStoredDecadeView(row.payload);
      if (view) return view;
      return parseStoredDecadeView({
        decade: decadeLabelFromInteger(row.decade),
        nodeIds: [],
        edgeIds: [],
      });
    })
    .filter((view): view is NonNullable<typeof view> => view !== undefined);

  const contentHashDigest =
    allTimePayload &&
    typeof allTimePayload === 'object' &&
    typeof (allTimePayload as Record<string, unknown>).contentHash === 'string'
      ? ((allTimePayload as Record<string, unknown>).contentHash as string)
      : '0'.repeat(64);

  return graphReleaseArtifactFromStored({
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    contentHash: { digest: contentHashDigest, algorithm: 'sha256' },
    adjacencyRows: parsedAdjacency,
    decadeRows: parsedDecades.map((view) => ({
      decade: view.decade,
      nodeIds: view.nodeIds,
      edgeIds: view.edgeIds,
    })),
    allTimeRow: {
      nodeIds: allTimeView.nodeIds,
      edgeIds: allTimeView.edgeIds,
      contentHash: contentHashDigest,
    },
  });
}

/** True when in-process graph rebuild fallback is enabled for one release cycle. */
export function historyGraphInProcessFallbackEnabled(): boolean {
  return process.env.HISTORY_GRAPH_IN_PROCESS_FALLBACK === '1';
}
