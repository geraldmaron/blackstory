/**
 * Collect bounded 1-hop / 2-hop neighbor ids for live entity hydration without
 * scanning the full public release collection.
 */

import {
  LEARNING_CONTINUE_LEARNING_CAP,
  LEARNING_RELATED_DISPLAY_CAP,
} from '@blap/domain';

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
