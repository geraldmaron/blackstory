/**
 * Publish-time graph artifact audit: decade coverage, canonical-edge retention,
 * adjacency cap transparency, and unexplained edge-drop detection.
 */
import { DEFAULT_ADJACENCY_CAP } from './adjacency.js';
import type { GraphReleaseArtifact } from './build.js';
import { deriveActiveDecadeBuckets } from './decades.js';
import type { DecadeBucketEntityInput } from './decades.js';
import type { EntityRelationship } from '../relationship.js';

export type GraphEdgeDropReason =
  | 'endpoint_not_in_release'
  | 'endpoint_not_in_decade_nodes'
  | 'temporal_decade_mismatch'
  | 'self_loop';

export type GraphEdgeDrop = {
  readonly relationshipId: string;
  readonly reason: GraphEdgeDropReason;
  readonly detail?: string;
};

export type AdjacencyCapHit = {
  readonly entityId: string;
  readonly totalCandidates: number;
  readonly cap: number;
  readonly truncated: number;
};

export type GraphPublishAuditReport = {
  readonly canonicalEdgeCount: number;
  readonly allTimeEdgeCount: number;
  readonly uniqueDecadeEdgeCount: number;
  readonly entitiesInRelease: number;
  readonly entitiesWithDecadeBuckets: number;
  readonly decadeCoveragePct: number;
  readonly adjacencyCapHits: readonly AdjacencyCapHit[];
  readonly droppedFromAllTime: readonly GraphEdgeDrop[];
  readonly unexplainedAllTimeDrops: number;
  readonly contentHash: string;
};

function edgeInAllTime(
  rel: EntityRelationship,
  releaseEntityIds: ReadonlySet<string>,
): GraphEdgeDrop | undefined {
  if (rel.fromEntityId === rel.toEntityId) {
    return { relationshipId: rel.id, reason: 'self_loop' };
  }
  if (!releaseEntityIds.has(rel.fromEntityId)) {
    return {
      relationshipId: rel.id,
      reason: 'endpoint_not_in_release',
      detail: `fromEntityId ${rel.fromEntityId}`,
    };
  }
  if (!releaseEntityIds.has(rel.toEntityId)) {
    return {
      relationshipId: rel.id,
      reason: 'endpoint_not_in_release',
      detail: `toEntityId ${rel.toEntityId}`,
    };
  }
  return undefined;
}

export type AuditGraphReleaseArtifactInput = {
  readonly artifact: GraphReleaseArtifact;
  readonly relationships: readonly EntityRelationship[];
  readonly releaseEntityIds: readonly string[];
  readonly decadeEntities: readonly DecadeBucketEntityInput[];
  readonly adjacencyCap?: number;
};

/** Audits a built graph release artifact against canonical relationships. */
export function auditGraphReleaseArtifact(
  input: AuditGraphReleaseArtifactInput,
): GraphPublishAuditReport {
  const releaseEntityIds = new Set(input.releaseEntityIds);
  const cap = input.adjacencyCap ?? DEFAULT_ADJACENCY_CAP;

  const droppedFromAllTime: GraphEdgeDrop[] = [];
  for (const rel of input.relationships) {
    const drop = edgeInAllTime(rel, releaseEntityIds);
    if (drop) droppedFromAllTime.push(drop);
  }

  const eligibleCanonical = input.relationships.filter((rel) => edgeInAllTime(rel, releaseEntityIds) === undefined);
  const allTimeEdgeIds = new Set(input.artifact.allTimeView.edgeIds);
  const unexplained: GraphEdgeDrop[] = [];
  for (const rel of eligibleCanonical) {
    if (!allTimeEdgeIds.has(rel.id)) {
      unexplained.push({
        relationshipId: rel.id,
        reason: 'endpoint_not_in_release',
        detail: 'missing from allTimeView despite both endpoints in release',
      });
    }
  }

  const decadeEdgeIds = new Set<string>();
  for (const view of input.artifact.decadeViews) {
    for (const edgeId of view.edgeIds) decadeEdgeIds.add(edgeId);
  }

  const entitiesWithDecadeBuckets = input.decadeEntities.filter(
    (entity) => deriveActiveDecadeBuckets(entity, { stillActiveCutoff: input.artifact.generatedAt }).length > 0,
  ).length;

  const adjacencyCapHits: AdjacencyCapHit[] = [];
  for (const [entityId, adjacency] of input.artifact.adjacencyByEntityId) {
    if (adjacency.totalCandidates > cap) {
      adjacencyCapHits.push({
        entityId,
        totalCandidates: adjacency.totalCandidates,
        cap,
        truncated: adjacency.totalCandidates - adjacency.entries.length,
      });
    }
  }

  const entitiesInRelease = input.releaseEntityIds.length;
  const decadeCoveragePct =
    entitiesInRelease === 0 ? 0 : (entitiesWithDecadeBuckets / entitiesInRelease) * 100;

  return {
    canonicalEdgeCount: input.relationships.length,
    allTimeEdgeCount: input.artifact.allTimeView.edgeIds.length,
    uniqueDecadeEdgeCount: decadeEdgeIds.size,
    entitiesInRelease,
    entitiesWithDecadeBuckets,
    decadeCoveragePct,
    adjacencyCapHits,
    droppedFromAllTime,
    unexplainedAllTimeDrops: unexplained.length,
    contentHash: input.artifact.contentHash.digest,
  };
}

export function graphPublishAuditFailureMessage(report: GraphPublishAuditReport): string {
  const parts: string[] = [];
  if (report.unexplainedAllTimeDrops > 0) {
    parts.push(`${report.unexplainedAllTimeDrops} unexplained all-time edge drop(s)`);
  }
  if (report.decadeCoveragePct < 90) {
    parts.push(
      `decade coverage ${report.decadeCoveragePct.toFixed(1)}% is below 90% (${report.entitiesWithDecadeBuckets}/${report.entitiesInRelease})`,
    );
  }
  return parts.join('; ');
}

export function graphPublishAuditPasses(
  report: GraphPublishAuditReport,
  options: { readonly minDecadeCoveragePct?: number } = {},
): boolean {
  const minCoverage = options.minDecadeCoveragePct ?? 90;
  return report.unexplainedAllTimeDrops === 0 && report.decadeCoveragePct >= minCoverage;
}
