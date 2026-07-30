/**
 * Serialize/deserialize graph release artifacts for bb_public.release_graph_* persistence.
 */
import type { Sha256Hash } from '../publication/index.js';
import type { EntityAdjacency } from './adjacency.js';
import type { GraphReleaseArtifact } from './build.js';
import type { AllTimeGraphView, DecadeGraphView } from './decades.js';
import { decadeStartYearFromLabel } from '../era.js';

export type StoredGraphAdjacencyRow = {
  readonly entityId: string;
  readonly totalCandidates: number;
  readonly entries: readonly unknown[];
};

export type StoredGraphDecadeRow = {
  readonly decade: string;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
};

export type StoredGraphAllTimeRow = {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly contentHash?: string;
  readonly schemaVersion?: number;
};

export function serializeGraphAdjacency(adjacency: EntityAdjacency): StoredGraphAdjacencyRow {
  return {
    entityId: adjacency.entityId,
    totalCandidates: adjacency.totalCandidates,
    entries: adjacency.entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      direction: entry.direction,
      relationshipId: entry.relationshipId,
      evidenceCount: entry.evidenceCount,
      ...(entry.timespan ? { timespan: entry.timespan } : {}),
    })),
  };
}

export function serializeGraphDecadeView(view: DecadeGraphView): StoredGraphDecadeRow {
  return {
    decade: view.decade,
    nodeIds: [...view.nodeIds],
    edgeIds: [...view.edgeIds],
  };
}

export function serializeGraphAllTimeView(
  view: AllTimeGraphView,
  contentHash: Sha256Hash,
): StoredGraphAllTimeRow {
  return {
    nodeIds: [...view.nodeIds],
    edgeIds: [...view.edgeIds],
    contentHash: contentHash.digest,
    schemaVersion: 1,
  };
}

export function decadeIntegerFromLabel(label: string): number | undefined {
  return decadeStartYearFromLabel(label);
}

export function parseStoredDecadeView(payload: unknown): DecadeGraphView | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const decade = typeof record.decade === 'string' ? record.decade : undefined;
  if (!decade) return undefined;
  const nodeIds = Array.isArray(record.nodeIds)
    ? record.nodeIds.filter((entry): entry is string => typeof entry === 'string')
    : Array.isArray(record.nodes)
      ? record.nodes.filter((entry): entry is string => typeof entry === 'string')
      : [];
  const edgeIds = Array.isArray(record.edgeIds)
    ? record.edgeIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return { decade, nodeIds, edgeIds };
}

export function parseStoredAllTimeView(payload: unknown): AllTimeGraphView | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const nodeIds = Array.isArray(record.nodeIds)
    ? record.nodeIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const edgeIds = Array.isArray(record.edgeIds)
    ? record.edgeIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return { nodeIds, edgeIds };
}

/** Rehydrates a GraphReleaseArtifact from stored release_graph_* payloads. */
export function graphReleaseArtifactFromStored(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly contentHash: Sha256Hash;
  readonly adjacencyRows: readonly StoredGraphAdjacencyRow[];
  readonly decadeRows: readonly StoredGraphDecadeRow[];
  readonly allTimeRow: StoredGraphAllTimeRow;
}): GraphReleaseArtifact {
  const adjacencyByEntityId = new Map<string, EntityAdjacency>();
  for (const row of input.adjacencyRows) {
    adjacencyByEntityId.set(row.entityId, {
      entityId: row.entityId,
      totalCandidates: row.totalCandidates,
      entries: (row.entries as EntityAdjacency['entries']) ?? [],
    });
  }
  const decadeViews = input.decadeRows
    .map((row) => ({ decade: row.decade, nodeIds: row.nodeIds, edgeIds: row.edgeIds }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    adjacencyByEntityId,
    decadeViews,
    allTimeView: {
      nodeIds: input.allTimeRow.nodeIds,
      edgeIds: input.allTimeRow.edgeIds,
    },
    contentHash: input.contentHash,
  };
}
