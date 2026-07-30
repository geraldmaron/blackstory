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

/** Returns a stored graph release artifact when all three tables are populated. */
export async function fetchStoredGraphReleaseArtifact(input: {
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
