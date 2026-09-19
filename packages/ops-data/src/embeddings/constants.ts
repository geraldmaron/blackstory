/** Embedding model, index dimensionality and bounded retrieval policy. */

/** gemini-embedding-001 supports Matryoshka truncation; native output is larger than this. */
export const EMBEDDING_MODEL = 'gemini-embedding-001' as const;

/** Truncated + unit-normalized output dimensionality stored on every entity vector. */
export const EMBEDDING_DIMS = 768 as const;

/** pgvector HNSW indexes support at most 2,000 dimensions for vector values. */
export const MAX_INDEXED_VECTOR_DIMS = 2000 as const;
/** Upper bound for one nearest-neighbor request. */
export const PLATFORM_MAX_NEIGHBORS = 1000 as const;

/**
 * Rough embedding cost anchor from the brief: ~$7.50 to embed 100k docs of ~500 tokens
 * each via gemini-embedding-001. Used only for backfill budget estimates, not billing truth.
 */
export const APPROX_USD_PER_1K_TOKENS = 0.00015 as const;
export const APPROX_TOKENS_PER_CHAR = 0.25 as const;
