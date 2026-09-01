/**
 * Bounded neighbor hydrate for `GET /v1/entities/:id`.
 *
 * Same batch pattern as web `loadLiveEntity`: ≤8 one-hop then ≤18 two-hop projections via
 * `ANY()` chunks — never one point-get per neighbor. Attaches `relatedNeighbors` and
 * `continueLearning` onto EntityV1 when edges resolve.
 */
import {
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  type NeighborLookup,
} from '@repo/domain';
import type { EntityV1 } from '@repo/public-contracts/v1/entity';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import type { RelatedNeighborV1 } from '@repo/public-contracts/v1/related';
import type { PublicEntityProjectionDoc } from '@repo/schemas';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids.js';
import { fetchPublicEntityProjectionsByIds, type PostgresQueryFn } from './postgres-readers.js';

function toNeighborLookup(projection: PublicEntityProjectionDoc): NeighborLookup {
  return {
    id: projection.id,
    displayName: projection.displayName,
    kind: projection.kind,
    summary: projection.summary,
    ...(projection.related !== undefined ? { related: projection.related } : {}),
  };
}

function stubToNeighborV1(
  stub: ReturnType<typeof buildRelatedNeighborStubs>[number],
): RelatedNeighborV1 {
  return {
    id: stub.id,
    displayName: stub.displayName,
    kind: stub.kind,
    summary: stub.summary,
    relationType: stub.relationType,
    direction: stub.direction,
    ...(stub.timespan !== undefined ? { timespan: stub.timespan } : {}),
  };
}

/**
 * Fetch bounded neighbor projections and attach denormalized learning links onto an EntityV1.
 * On fetch failure, returns the entity unchanged (same honesty as web's seed-free fallback).
 */
export async function hydrateEntityV1Neighbors(
  entity: EntityV1,
  releaseId: string,
  query: PostgresQueryFn,
): Promise<EntityV1> {
  const oneHopIds = collectOneHopNeighborIds({
    ...(entity.related !== undefined ? { related: entity.related } : {}),
  });
  if (oneHopIds.length === 0) return entity;

  try {
    const oneHopProjections = await fetchPublicEntityProjectionsByIds(releaseId, oneHopIds, query);
    const oneHopLookups = oneHopProjections.map(toNeighborLookup);
    const twoHopIds = collectTwoHopNeighborIds(entity.id, oneHopIds, oneHopLookups);
    const twoHopProjections =
      twoHopIds.length > 0
        ? await fetchPublicEntityProjectionsByIds(releaseId, twoHopIds, query)
        : [];

    const neighborsById = new Map<string, NeighborLookup>();
    neighborsById.set(entity.id, {
      id: entity.id,
      displayName: entity.displayName,
      kind: entity.kind,
      summary: entity.summary,
      ...(entity.related !== undefined ? { related: entity.related } : {}),
    });
    for (const projection of [...oneHopProjections, ...twoHopProjections]) {
      neighborsById.set(projection.id, toNeighborLookup(projection));
    }

    const relatedStubs = buildRelatedNeighborStubs(entity.related, neighborsById);
    const continueStubs = composeContinueLearningStubs(entity.id, relatedStubs, neighborsById);
    const relatedNeighbors = relatedStubs.map(stubToNeighborV1);
    const continueLearning = continueStubs.map(stubToNeighborV1);

    const candidate: EntityV1 = {
      ...entity,
      ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : {}),
      ...(continueLearning.length > 0 ? { continueLearning } : {}),
    };
    const parsed = entityV1Schema.safeParse(candidate);
    return parsed.success ? parsed.data : entity;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[api-public] neighbor batch failed for ${entity.id}; returning entity without neighbors: ${message}`,
    );
    return entity;
  }
}
