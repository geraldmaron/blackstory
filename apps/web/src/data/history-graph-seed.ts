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
        eraBuckets: entity.eraBuckets,
        statusHistory: entity.statusHistory,
        ...(entity.eventWindow?.startAt
          ? {
              eventWindow: {
                startAt: entity.eventWindow.startAt,
                ...(entity.eventWindow.endAt !== undefined
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

function catalogCacheKey(entities: readonly PublicEntityView[]): string {
  return entities
    .map((entity) => entity.id)
    .sort((a, b) => a.localeCompare(b))
    .join('\0');
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
