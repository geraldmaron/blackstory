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
  type LearningRelatedEdge,
  type NeighborLookup,
} from '@repo/domain';
import type { EntityV1 } from '@repo/public-contracts/v1/entity';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import type { EvidenceInputsV1 } from '@repo/public-contracts/v1/evidence-inputs';
import type { RelatedEntryV1, RelatedNeighborV1 } from '@repo/public-contracts/v1/related';
import { recordEvidenceInputs } from '@repo/public-contracts/evidence';
import type { PublicClaimProjectionDoc, PublicEntityProjectionDoc } from '@repo/schemas';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids.js';
import { fetchPublicEntityProjectionsByIds, type PostgresQueryFn } from './postgres-readers.js';

type RelatedEdgeInput = Pick<RelatedEntryV1, 'id' | 'type' | 'direction' | 'timespan'>;

function normalizeTimespan(
  timespan: RelatedEdgeInput['timespan'],
): LearningRelatedEdge['timespan'] | undefined {
  if (timespan === undefined) return undefined;
  return {
    ...(timespan.label !== undefined ? { label: timespan.label } : {}),
    ...(timespan.validFrom !== undefined ? { validFrom: timespan.validFrom } : {}),
    ...(timespan.validTo !== undefined ? { validTo: timespan.validTo } : {}),
  };
}

function normalizeRelatedEdge(edge: RelatedEdgeInput): LearningRelatedEdge {
  const timespan = normalizeTimespan(edge.timespan);
  return {
    id: edge.id,
    type: edge.type,
    direction: edge.direction,
    ...(timespan !== undefined ? { timespan } : {}),
  };
}

function normalizeRelatedEdges(
  related: readonly RelatedEdgeInput[],
): readonly LearningRelatedEdge[] {
  return related.map(normalizeRelatedEdge);
}

function toNeighborLookup(projection: PublicEntityProjectionDoc): NeighborLookup {
  const related =
    projection.related !== undefined ? normalizeRelatedEdges(projection.related) : undefined;
  return {
    id: projection.id,
    displayName: projection.displayName,
    kind: projection.kind,
    summary: projection.summary,
    ...(related !== undefined ? { related } : {}),
  };
}

function entityToNeighborLookup(entity: EntityV1): NeighborLookup {
  const related = entity.related !== undefined ? normalizeRelatedEdges(entity.related) : undefined;
  return {
    id: entity.id,
    displayName: entity.displayName,
    kind: entity.kind,
    summary: entity.summary,
    ...(related !== undefined ? { related } : {}),
  };
}

/**
 * A neighbor's evidence INPUTS, so its link row can carry the same meter the record it links to
 * carries. Inputs, never a letter: the grade is `confidenceTierFromEvidenceInputs`'s to give, and
 * a tier frozen into a payload is the cached conclusion `apps/web/src/lib/records/
 * build-records-index.ts` refuses to serve. `recordEvidenceInputs` is pure projection over the
 * claim rows — which levels are present, which lineages are cited, which of those are evidence
 * about the subject rather than the record's own index row.
 *
 * `undefined` when the neighbor projection published no claims array: "we have no claims for
 * this neighbor" is not "this neighbor is unassessed", and the row must be able to say so by
 * showing no meter at all.
 */
function neighborEvidenceInputs(
  projection: PublicEntityProjectionDoc | undefined,
): EvidenceInputsV1 | undefined {
  const claims: readonly PublicClaimProjectionDoc[] | undefined = projection?.claims;
  if (claims === undefined) return undefined;
  const inputs = recordEvidenceInputs(claims);
  return {
    strongestClaimLevel: inputs.strongestClaimLevel,
    citedLineageKeys: [...inputs.citedLineageKeys],
    evidenceLineageKeys: [...inputs.evidenceLineageKeys],
  };
}

function stubToNeighborV1(
  stub: ReturnType<typeof buildRelatedNeighborStubs>[number],
  evidenceInputs: EvidenceInputsV1 | undefined,
): RelatedNeighborV1 {
  return {
    id: stub.id,
    displayName: stub.displayName,
    kind: stub.kind,
    summary: stub.summary,
    relationType: stub.relationType,
    direction: stub.direction,
    ...(stub.timespan !== undefined ? { timespan: stub.timespan } : {}),
    ...(evidenceInputs !== undefined ? { evidenceInputs } : {}),
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
    neighborsById.set(entity.id, entityToNeighborLookup(entity));
    for (const projection of [...oneHopProjections, ...twoHopProjections]) {
      neighborsById.set(projection.id, toNeighborLookup(projection));
    }

    const entityRelated =
      entity.related !== undefined ? normalizeRelatedEdges(entity.related) : undefined;
    // The projections are already in hand from the two batches above, so the neighbor meter
    // costs no extra query — only a lookup per stub.
    const projectionsById = new Map<string, PublicEntityProjectionDoc>();
    for (const projection of [...oneHopProjections, ...twoHopProjections]) {
      projectionsById.set(projection.id, projection);
    }
    const toNeighbor = (stub: ReturnType<typeof buildRelatedNeighborStubs>[number]) =>
      stubToNeighborV1(stub, neighborEvidenceInputs(projectionsById.get(stub.id)));

    const relatedStubs = buildRelatedNeighborStubs(entityRelated, neighborsById);
    const continueStubs = composeContinueLearningStubs(entity.id, relatedStubs, neighborsById);
    const relatedNeighbors = relatedStubs.map(toNeighbor);
    const continueLearning = continueStubs.map(toNeighbor);

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
