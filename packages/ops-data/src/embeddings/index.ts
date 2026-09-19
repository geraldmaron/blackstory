/** Embedding pipeline and vector-store contracts. */
export {
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
  MAX_INDEXED_VECTOR_DIMS,
  PLATFORM_MAX_NEIGHBORS,
  APPROX_USD_PER_1K_TOKENS,
  APPROX_TOKENS_PER_CHAR,
} from './constants.js';

export {
  InvalidEmbeddingVectorError,
  magnitude,
  normalizeVector,
  truncateVector,
  truncateAndNormalize,
  dotProduct,
  dotProductDistance,
  isUnitVector,
  assertValidEmbeddingVector,
} from './vector-math.js';
export type { EmbeddingVector } from './vector-math.js';

export {
  resolveEntityYearSpan,
  deriveEraBucket,
  deriveEntityFilters,
  buildEntityEmbeddingText,
} from './text.js';
export type { EntityLocationContext, EntityEmbeddingSource, EntityVectorFilters } from './text.js';

export {
  EmbeddingProviderError,
  createRetryingEmbeddingProvider,
  createDeterministicMockEmbeddingProvider,
} from './provider.js';
export type { EmbeddingProvider, RetryOptions, MockEmbeddingProviderOptions } from './provider.js';

export { createGeminiEmbeddingProvider } from './gemini-provider.js';
export type {
  GeminiEmbeddingProviderOptions,
  GeminiEmbedContentClient,
} from './gemini-provider.js';

export {
  embedEntity,
  embedEntitiesBatch,
  estimateEmbeddingCostUsd,
  sha256Hex,
} from './pipeline.js';
export type {
  EntityEmbeddingInput,
  EntityEmbeddingResult,
  EmbedEntityOptions,
  BatchEmbedOptions,
  BatchEmbedResult,
} from './pipeline.js';

export { createInMemoryVectorIndexStore } from './vector-store.js';
export type {
  EntityEmbeddingDoc,
  VectorQueryInput,
  VectorQueryMatch,
  VectorIndexStore,
} from './vector-store.js';

export { runBackfill } from './backfill-cli.js';
export type {
  BackfillOptions,
  BackfillSummary,
  CanonicalEntitySource,
  CanonicalEntitySourcePage,
  ExistingEmbeddingHashLookup,
} from './backfill-cli.js';

export {
  mapSearchIndexRecordToEmbeddingInput,
  parseStateCodeFromJurisdiction,
} from './backfill-sources.js';
export type { SearchIndexEmbeddingRecord } from './backfill-sources.js';

export {
  createPostgresCanonicalEntitySource,
  createPostgresExistingHashLookup,
} from './backfill-sources-postgres.js';

export { createPostgresVectorIndexStore } from './postgres-vector-store.js';
export type { PostgresQueryExecutor } from './postgres-vector-store.js';
