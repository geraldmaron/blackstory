/**
 * Embedding-vector similarity surface for research-side reuse (BB-071): candidate recall and
 * near-duplicate detection. Pure math — no Firestore, no I/O. Vectors are computed by
 * @black-book/firebase's embedding pipeline; wiring these functions into the live discovery
 * workflow (workers/research/) is a documented integration point, not done in this pass — see
 * docs/adr/ADR-014-vector-search.md.
 */
export { InvalidEmbeddingVectorError, dotProduct, cosineSimilarity, isUnitVector } from './vector-math.js';
export type { EmbeddingVector } from './vector-math.js';

export { findSimilarCandidates } from './candidate-recall.js';
export type { RecallCandidate, RecallMatch, FindSimilarCandidatesOptions } from './candidate-recall.js';

export {
  DEFAULT_NEAR_DUPLICATE_THRESHOLD,
  findNearDuplicatesOf,
  clusterNearDuplicates,
} from './near-duplicate.js';
export type { NearDuplicateItem, NearDuplicateFlag, NearDuplicateCluster } from './near-duplicate.js';
