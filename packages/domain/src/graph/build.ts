/**
 * Derived graph-view release-artifact build, following the
 * immutable-release pattern (`../publication/index.ts`): `publicReleases/{releaseId}/graph/...`
 * docs, deterministic content hashing via the same `canonicalJson`/`sha256Json` — the entity
 * projection/snapshot manifest uses, and the same `publicReleases/{releaseId}/...` path shape as
 * `publicEntityProjectionPath`.
 *
 * "Derived-at-publish over request-time traversal": this module never reads
 * Firestore itself it is a pure function over already-loaded entities/relationships, run once
 * per publication-worker release build (mirroring `../map/map-source.ts`'s `buildMapSource`
 * shape) and persisted as part of the release. No graph database, no per-request traversal.
 *
 * Deterministic cycle-safe bounded-depth re-runnable:
 * - Deterministic: every sub-builder (`buildAllEntityAdjacency`, `buildDecadeViews`,
 * `buildAllTimeView`) sorts its own output; this module adds no randomness or wall-clock reads
 * beyond the caller-supplied `generatedAt`, and the resulting `contentHash` proves byte-for-byte
 * reproducibility across runs (`assertGraphReleaseArtifactReproducible` below re-runs the build
 * and compares hashes).
 * - Cycle-safe bounded-depth: adjacency is single-hop (no traversal); the one multi-hop
 * traversal in this subsystem (containment chains) lives in `./containment.ts` and is
 * independently cycle-safe/bounded-depth there.
 * - Re-runnable: pure function, safe to invoke repeatedly against the same or updated inputs
 * during a publication-worker retry.
 */
import { sha256Json, type JsonValue, type Sha256Hash } from '../publication/index.js';
import type { EntityRelationship } from '../relationship.js';
import {
  buildAllEntityAdjacency,
  DEFAULT_ADJACENCY_CAP,
  toPublicRelatedEntries,
  type EntityAdjacency,
  type PublicRelatedEntry,
} from './adjacency.js';
import {
  buildAllTimeView,
  buildDecadeViews,
  type AllTimeGraphView,
  type DecadeBucketEntityInput,
  type DecadeGraphView,
} from './decades.js';

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

/** Mirrors `../publication/index.ts`'s private `assertSafePathSegment` (not exported there) so
 * graph-doc paths get the same storage-path safety guarantee as entity projection paths. */
function assertSafePathSegment(value: string, field: string): void {
  if (!SAFE_PATH_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`${field} is not a safe storage path segment`);
  }
}

/** `publicReleases/{releaseId}/graphAdjacency/{entityId}` — one bounded adjacency doc per entity. */
export function publicGraphAdjacencyPath(releaseId: string, entityId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  assertSafePathSegment(entityId, 'entityId');
  return `publicReleases/${releaseId}/graphAdjacency/${entityId}`;
}

/** `publicReleases/{releaseId}/graphDecades/{decade}` — one node/edge-set doc per decade label. */
export function publicGraphDecadePath(releaseId: string, decade: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  assertSafePathSegment(decade, 'decade');
  return `publicReleases/${releaseId}/graphDecades/${decade}`;
}

/** `publicReleases/{releaseId}/graph/all-time` the all-time union view doc. */
export function publicGraphAllTimePath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `publicReleases/${releaseId}/graph/all-time`;
}

export type GraphReleaseArtifactInput = {
  readonly releaseId: string;
  readonly generatedAt: string;
  /** Every entity id the adjacency docs should be built for (typically every published entity). */
  readonly entityIds: readonly string[];
  /** Active-span inputs for decade bucketing see `./decades.ts`'s `DecadeBucketEntityInput`. */
  readonly entities: readonly DecadeBucketEntityInput[];
  readonly relationships: readonly EntityRelationship[];
  readonly adjacencyCap?: number;
};

export type GraphReleaseArtifact = {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly adjacencyByEntityId: ReadonlyMap<string, EntityAdjacency>;
  readonly decadeViews: readonly DecadeGraphView[];
  readonly allTimeView: AllTimeGraphView;
  /** sha256 over the canonicalized adjacency+decade+all-time payload the reproducibility proof. */
  readonly contentHash: Sha256Hash;
};

function artifactPayload(
  adjacencyByEntityId: ReadonlyMap<string, EntityAdjacency>,
  decadeViews: readonly DecadeGraphView[],
  allTimeView: AllTimeGraphView,
): JsonValue {
  const adjacency: Record<string, JsonValue> = {};
  for (const [entityId, adj] of [...adjacencyByEntityId].sort(([a], [b]) => a.localeCompare(b))) {
    adjacency[entityId] = {
      entityId: adj.entityId,
      totalCandidates: adj.totalCandidates,
      entries: adj.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        direction: entry.direction,
        relationshipId: entry.relationshipId,
        evidenceCount: entry.evidenceCount,
        ...(entry.timespan
          ? {
              timespan: {
                ...(entry.timespan.label !== undefined ? { label: entry.timespan.label } : {}),
                ...(entry.timespan.validFrom !== undefined
                  ? { validFrom: entry.timespan.validFrom }
                  : {}),
                ...(entry.timespan.validTo !== undefined
                  ? { validTo: entry.timespan.validTo }
                  : {}),
              },
            }
          : {}),
      })) as unknown as JsonValue,
    };
  }
  return {
    adjacency,
    decadeViews: decadeViews.map((view) => ({
      decade: view.decade,
      nodeIds: [...view.nodeIds],
      edgeIds: [...view.edgeIds],
    })) as unknown as JsonValue,
    allTimeView: { nodeIds: [...allTimeView.nodeIds], edgeIds: [...allTimeView.edgeIds] },
  };
}

/**
 * Builds the full graph release artifact: per-entity bounded adjacency, per-decade node/edge
 * sets (active-span bucketed see `./decades.ts`), and the all-time union view, plus a
 * deterministic content hash over all three.
 */
export function buildGraphReleaseArtifact(input: GraphReleaseArtifactInput): GraphReleaseArtifact {
  const adjacencyByEntityId = buildAllEntityAdjacency(input.entityIds, input.relationships, {
    cap: input.adjacencyCap ?? DEFAULT_ADJACENCY_CAP,
  });
  const decadeViews = buildDecadeViews(
    { entities: input.entities, relationships: input.relationships },
    { stillActiveCutoff: input.generatedAt },
  );
  const allTimeView = buildAllTimeView(decadeViews, {
    entityIds: input.entityIds,
    relationships: input.relationships,
  });
  const contentHash = sha256Json(artifactPayload(adjacencyByEntityId, decadeViews, allTimeView));

  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    adjacencyByEntityId,
    decadeViews,
    allTimeView,
    contentHash,
  };
}

/**
 * Re-runnability proof: rebuilds the artifact from the same input and asserts the content hash
 * (and therefore every derived view) is byte-for-byte identical. A publication-worker retry after
 * a transient failure must be safe to simply call `buildGraphReleaseArtifact` again this
 * function is what a regression test (and -style gold-corpus fixtures, see `./fixtures.ts`)
 * exercises to prove that holds.
 */
export function assertGraphReleaseArtifactReproducible(input: GraphReleaseArtifactInput): void {
  const first = buildGraphReleaseArtifact(input);
  const second = buildGraphReleaseArtifact(input);
  if (first.contentHash.digest !== second.contentHash.digest) {
    throw new Error(
      'Graph release artifact build is not deterministic: re-running buildGraphReleaseArtifact ' +
        `against identical input produced different content hashes (${first.contentHash.digest} vs ` +
        `${second.contentHash.digest}).`,
    );
  }
}

/** Per-entity public related entries for every entity in the artifact acceptance
 * criterion 5's `{id, type, direction, timespan}` shape, ready to merge into a public entity
 * projection. */
export function publicRelatedEntriesByEntityId(
  artifact: GraphReleaseArtifact,
): ReadonlyMap<string, readonly PublicRelatedEntry[]> {
  const result = new Map<string, readonly PublicRelatedEntry[]>();
  for (const [entityId, adjacency] of artifact.adjacencyByEntityId) {
    result.set(entityId, toPublicRelatedEntries(adjacency));
  }
  return result;
}
