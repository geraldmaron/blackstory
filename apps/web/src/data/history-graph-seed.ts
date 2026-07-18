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
  type DecadeBucketEntityInput,
  type GraphReleaseArtifact,
} from '@blap/domain';
import { SEED_ENTITY_RELATIONSHIPS } from './entity-graph-seed';
import { listPublicEntities, type PublicEntityView } from './public-seed';

export const HISTORY_GRAPH_RELEASE_ID = 'seed-snapshot';
export const HISTORY_GRAPH_GENERATED_AT = '2026-07-17T00:00:00.000Z';

function activeSpansFor(entity: PublicEntityView): DecadeBucketEntityInput['activeSpans'] {
  if (entity.statusHistory && entity.statusHistory.length > 0) {
    // Records without a validFrom cannot be placed in a decade bucket — skip them.
    return entity.statusHistory.flatMap((record) =>
      record.validFrom !== undefined
        ? [
            {
              validFrom: record.validFrom,
              ...(record.validTo !== undefined ? { validTo: record.validTo } : {}),
              datePrecision: record.datePrecision,
            },
          ]
        : [],
    );
  }
  if (entity.eventWindow?.startAt) {
    return [
      {
        validFrom: entity.eventWindow.startAt,
        ...(entity.eventWindow.endAt !== undefined ? { validTo: entity.eventWindow.endAt } : {}),
        datePrecision: entity.eventWindow.datePrecision,
      },
    ];
  }
  if (entity.eraBuckets && entity.eraBuckets.length > 0) {
    const first = entity.eraBuckets[0]!;
    const last = entity.eraBuckets[entity.eraBuckets.length - 1]!;
    const startYear = first.slice(0, 4);
    const endYear = last.slice(0, 4);
    return [{ validFrom: startYear, validTo: `${Number.parseInt(endYear, 10) + 9}`, datePrecision: 'year' }];
  }
  return [];
}

function decadeBucketInputs(entities: readonly PublicEntityView[]): readonly DecadeBucketEntityInput[] {
  return entities
    .map((entity) => {
      const activeSpans = activeSpansFor(entity);
      if (activeSpans.length === 0) return undefined;
      return { entityId: entity.id, activeSpans };
    })
    .filter((input): input is DecadeBucketEntityInput => input !== undefined);
}

let cachedArtifact: GraphReleaseArtifact | undefined;

/** Lazily builds and memoizes the seed graph release artifact for `/history`.  */
export function getHistoryGraphReleaseArtifact(): GraphReleaseArtifact {
  if (cachedArtifact) return cachedArtifact;
  const entities = listPublicEntities();
  cachedArtifact = buildGraphReleaseArtifact({
    releaseId: HISTORY_GRAPH_RELEASE_ID,
    generatedAt: HISTORY_GRAPH_GENERATED_AT,
    entityIds: entities.map((entity) => entity.id),
    entities: decadeBucketInputs(entities),
    relationships: [...SEED_ENTITY_RELATIONSHIPS],
  });
  return cachedArtifact;
}

/** Resets the memoized artifact test-only hook.  */
export function resetHistoryGraphReleaseArtifactForTests(): void {
  cachedArtifact = undefined;
}
