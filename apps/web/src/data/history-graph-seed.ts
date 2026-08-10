/**
 * graph release artifact for the `/history` browse surface.
 *
 * Derives decade views and the all-time union from `./public-seed.ts` entities and
 * `./entity-graph-seed.ts` relationships via `buildGraphReleaseArtifact` — the same pure
 * publish-time pipeline `packages/domain/src/graph/build.ts` runs in production. This module
 * stands in for `publicReleases/{releaseId}/graph/*` until release worker is wired.
 */
import {
  buildGraphReleaseArtifact,
  deriveGraphDecadeBucketInput,
  type DecadeBucketEntityInput,
  type GraphReleaseArtifact,
} from '@repo/domain';
import { listPublicEntities, type PublicEntityView } from './public-seed';
import { resolveHistoryRelationships } from '../lib/history/resolve-history-relationships';
import {
  fetchStoredGraphReleaseArtifact,
  historyGraphInProcessFallbackEnabled,
} from '../lib/public-data/release-graph-readers';

export const HISTORY_GRAPH_RELEASE_ID = 'seed-snapshot';
export const HISTORY_GRAPH_GENERATED_AT = '2026-07-17T00:00:00.000Z';

function decadeBucketInputs(
  entities: readonly PublicEntityView[],
): readonly DecadeBucketEntityInput[] {
  return entities
    .map((entity) =>
      deriveGraphDecadeBucketInput({
        entityId: entity.id,
        kind: entity.kind,
        ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
        ...(entity.statusHistory !== undefined ? { statusHistory: entity.statusHistory } : {}),
        ...(entity.eventWindow?.startAt
          ? {
              eventWindow: {
                startAt: entity.eventWindow.startAt,
                ...(typeof entity.eventWindow.endAt === 'string'
                  ? { endAt: entity.eventWindow.endAt }
                  : {}),
                datePrecision: entity.eventWindow.datePrecision,
              },
            }
          : {}),
      }),
    )
    .filter((input): input is DecadeBucketEntityInput => input !== undefined);
}

/**
 * Identity of a catalog, for memo lookup only.
 *
 * This used to map every id, sort them with `localeCompare` and join them into one string: at
 * 4,081 entities that is a collator-driven sort plus a ~100KB allocation, paid on EVERY request
 * to `/`, the highest-traffic route, purely to look up a Map entry that was almost always
 * already there.
 *
 * The cheap key is order-insensitive without sorting: count plus an XOR-fold of a per-id hash.
 * XOR is commutative, so two orderings of the same id set agree, which is the property the sort
 * was there to provide.
 *
 * Collision risk is acceptable *here* specifically because this key never crosses a release
 * boundary on its own: the caller prefixes it with the releaseId, and within one release the
 * catalog is a fixed set. A collision would require two same-length id sets in one release whose
 * hashes XOR-fold identically, and the consequence would be serving a graph built from a
 * sibling catalog of identical size, not corrupted data.
 */
function catalogCacheKey(entities: readonly PublicEntityView[]): string {
  let fold = 0;
  for (const entity of entities) {
    let hash = 0x811c9dc5;
    const id = entity.id;
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    fold ^= hash;
  }
  return `${entities.length}:${(fold >>> 0).toString(36)}`;
}

const artifactCache = new Map<string, GraphReleaseArtifact>();

export type HistoryGraphReleaseOptions = {
  readonly releaseId?: string;
  readonly generatedAt?: string;
};

/** Builds a graph release artifact from the injected public entity catalog. */
export function buildHistoryGraphReleaseArtifact(
  entities: readonly PublicEntityView[],
  options: HistoryGraphReleaseOptions = {},
): GraphReleaseArtifact {
  return buildGraphReleaseArtifact({
    releaseId: options.releaseId ?? HISTORY_GRAPH_RELEASE_ID,
    generatedAt: options.generatedAt ?? HISTORY_GRAPH_GENERATED_AT,
    entityIds: entities.map((entity) => entity.id),
    entities: decadeBucketInputs(entities),
    relationships: [...resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT)],
  });
}

/**
 * Lazily builds and memoizes the graph release artifact for `/history`, keyed by the injected
 * entity catalog so live and seed snapshots never share a stale cache entry.
 */
export function getHistoryGraphReleaseArtifact(
  entities: readonly PublicEntityView[] = listPublicEntities(),
  options: HistoryGraphReleaseOptions = {},
): GraphReleaseArtifact {
  const releaseId = options.releaseId ?? HISTORY_GRAPH_RELEASE_ID;
  const cacheKey = `${releaseId}\0${catalogCacheKey(entities)}`;
  const cached = artifactCache.get(cacheKey);
  if (cached) return cached;
  const artifact = buildHistoryGraphReleaseArtifact(entities, { ...options, releaseId });
  artifactCache.set(cacheKey, artifact);
  return artifact;
}

/** Resets the memoized artifact cache — test-only hook. */
export function resetHistoryGraphReleaseArtifactForTests(): void {
  artifactCache.clear();
}

export type ResolveHistoryGraphReleaseOptions = HistoryGraphReleaseOptions & {
  readonly generatedAt?: string;
};

/**
 * Resolves the graph release artifact: prefers stored bb_public.release_graph_* payloads,
 * falling back to in-process build when HISTORY_GRAPH_IN_PROCESS_FALLBACK=1 or stored rows
 * are absent.
 */
export async function resolveHistoryGraphReleaseArtifact(
  entities: readonly PublicEntityView[] = listPublicEntities(),
  options: ResolveHistoryGraphReleaseOptions = {},
): Promise<GraphReleaseArtifact> {
  const releaseId = options.releaseId ?? HISTORY_GRAPH_RELEASE_ID;
  const generatedAt = options.generatedAt ?? HISTORY_GRAPH_GENERATED_AT;

  if (!historyGraphInProcessFallbackEnabled() && releaseId !== HISTORY_GRAPH_RELEASE_ID) {
    const stored = await fetchStoredGraphReleaseArtifact({ releaseId, generatedAt });
    if (stored) return stored;
  }

  return getHistoryGraphReleaseArtifact(entities, { ...options, releaseId });
}
