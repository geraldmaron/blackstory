/**
 * The story-cites-record edge, as the site imports it.
 *
 * The derivation itself moved to `@repo/domain/publication/cites-edge` when the phone needed the
 * same edge: `apps/api-public` folds it onto `/v1/entity/:id` and `/v1/map`, and two copies of
 * "which stories cite this record" would let the site and the app answer differently for the
 * same release. That module carries the design rationale — the two signals, why "mapped in"
 * outranks "referenced in", and what is deliberately excluded.
 *
 * This file stays as the site's import path so every existing consumer (the Explore selection
 * hook, the record room, the home first paint) keeps one stable specifier.
 */
export {
  CITES_RELATIONS,
  articleCitedEntities,
  buildCitesEdge,
  storiesCiting,
} from '@repo/domain/publication/cites-edge';
export type {
  CitesEdgeIndex,
  CitesRelation,
  StoryCitation,
} from '@repo/domain/publication/cites-edge';
