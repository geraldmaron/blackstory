/**
 * Embedding-vector similarity surface for research-side reuse: candidate recall and
 * near-duplicate detection. Pure math — no Firestore, no I/O. Vectors are computed by
 * `@repo/firebase`'s embedding pipeline.
 *
 * Not wired live: wiring these functions into the live discovery workflow (`workers/research/`)
 * is documented in `docs/adr/ADR-014-vector-search.md`.
 */
export {
  InvalidEmbeddingVectorError,
  dotProduct,
  cosineSimilarity,
  isUnitVector,
} from './vector-math.js';
export type { EmbeddingVector } from './vector-math.js';

export { findSimilarCandidates } from './candidate-recall.js';
export type {
  RecallCandidate,
  RecallMatch,
  FindSimilarCandidatesOptions,
} from './candidate-recall.js';

export {
  DEFAULT_NEAR_DUPLICATE_THRESHOLD,
  findNearDuplicatesOf,
  clusterNearDuplicates,
} from './near-duplicate.js';
export type {
  NearDuplicateItem,
  NearDuplicateFlag,
  NearDuplicateCluster,
} from './near-duplicate.js';
