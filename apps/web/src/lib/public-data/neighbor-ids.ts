/**
 * Collect bounded 1-hop / 2-hop neighbor ids for live entity hydration without
 * scanning the full public release collection.
 */

import { LEARNING_CONTINUE_LEARNING_CAP, LEARNING_RELATED_DISPLAY_CAP } from '@repo/domain';

export type RelatedEdgeLike = {
  readonly id: string;
  readonly related?: readonly { readonly id: string }[];
};

/**
 * First-hop related edge ids (display-capped). Falls back to legacy `relatedIds`.
 */
export function collectOneHopNeighborIds(entity: {
  readonly related?: readonly { readonly id: string }[];
  readonly relatedIds?: readonly string[];
}): readonly string[] {
  if (entity.related && entity.related.length > 0) {
    return entity.related.slice(0, LEARNING_RELATED_DISPLAY_CAP).map((edge) => edge.id);
  }
  return (entity.relatedIds ?? []).slice(0, LEARNING_RELATED_DISPLAY_CAP);
}

/**
 * Second-hop candidate ids from already-fetched 1-hop neighbors.
 * Caps fetch set so continue-learning does not explode read fan-out.
 */
export function collectTwoHopNeighborIds(
  entityId: string,
  oneHopIds: readonly string[],
  oneHopNeighbors: readonly RelatedEdgeLike[],
): readonly string[] {
  const excluded = new Set<string>([entityId, ...oneHopIds]);
  const candidates: string[] = [];
  // Fetch a small multiple of the display cap so composeContinueLearningStubs
  // still has room to prefer neighbors with summaries.
  const fetchCap = LEARNING_CONTINUE_LEARNING_CAP * 3;

  for (const neighbor of oneHopNeighbors) {
    for (const edge of neighbor.related ?? []) {
      if (excluded.has(edge.id)) continue;
      excluded.add(edge.id);
      candidates.push(edge.id);
      if (candidates.length >= fetchCap) return candidates;
    }
  }
  return candidates;
}

/**
 * Third-hop candidate ids, for the record room's relationship map only.
 *
 * The outer ring is the one that explodes, so this is capped harder than the second hop rather
 * than more generously: it buys one extra `getAll` per record page and nothing else, and the map
 * draws whatever that budget paid for (`buildRelationshipGraph` drops edges pointing at records
 * it was not given). `alreadyFetched` must contain the center plus every 1-hop and 2-hop id, so a
 * record already on the map is never refetched to sit on it a second time.
 */
export function collectThreeHopNeighborIds(
  alreadyFetched: readonly string[],
  twoHopNeighbors: readonly RelatedEdgeLike[],
): readonly string[] {
  const excluded = new Set<string>(alreadyFetched);
  const candidates: string[] = [];
  const fetchCap = RELATIONSHIP_MAP_THIRD_HOP_FETCH_CAP;

  for (const neighbor of twoHopNeighbors) {
    for (const edge of neighbor.related ?? []) {
      if (excluded.has(edge.id)) continue;
      excluded.add(edge.id);
      candidates.push(edge.id);
      if (candidates.length >= fetchCap) return candidates;
    }
  }
  return candidates;
}

/**
 * Ids fetched for the map's third ring. Twice the display cap so the ring has something to
 * choose from after `buildRelationshipGraph` sorts by date, and no more than that — this is a
 * live Postgres round-trip on every record page.
 */
export const RELATIONSHIP_MAP_THIRD_HOP_FETCH_CAP = 24;
