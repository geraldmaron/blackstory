/**
 * Embedding pipeline and Firestore vector-search constants.
 *
 * Model choice, dimensionality, and distance measure are locked here rather than left to
 * caller defaults so the "control over model, dims, retries" rationale in ADR-014 stays true
 * in code, not just prose this is the deliberate alternative to the pre-GA
 * `firestore-vector-search` extension.
 */

/** gemini-embedding-001 supports Matryoshka truncation; native output is larger than this. */
export const EMBEDDING_MODEL = 'gemini-embedding-001' as const;

/** Truncated + unit-normalized output dimensionality stored on every entity vector. */
export const EMBEDDING_DIMS = 768 as const;

/** Firestore vector field hard cap (KNN is an exact/flat scan up to this width). */
export const FIRESTORE_VECTOR_DIM_CAP = 2048 as const;

/** Firestore findNearest platform ceiling app-level caps must stay well under this. */
export const PLATFORM_MAX_NEIGHBORS = 1000 as const;

/** Sibling collection holding one embedding document per canonical entity (see ADR-014). */
export const ENTITY_EMBEDDINGS_COLLECTION = 'entityEmbeddings' as const;

/** Firestore vector field name inside each entityEmbeddings document. */
export const VECTOR_FIELD_NAME = 'embedding' as const;

/** DOT_PRODUCT is equivalent to cosine similarity for unit-normalized vectors but cheaper. */
export const DISTANCE_MEASURE = 'DOT_PRODUCT' as const;

/**
 * Firestore doubles the normal per-1000-entries read metering to 1 read per 100 vector index
 * entries scanned, on top of 1 read per document returned. Pre-filtering (kind/state/eraBucket)
 * is the lever that keeps scanned-entry counts and therefore cost small. Recorded in
 * ADR-014. Detailed budget/cost docs live under docs/security/.
 */
export const VECTOR_INDEX_READ_METERING_DIVISOR = 100 as const;
export const STANDARD_INDEX_READ_METERING_DIVISOR = 1_000 as const;

/**
 * Rough embedding cost anchor from the brief: ~$7.50 to embed 100k docs of ~500 tokens
 * each via gemini-embedding-001. Used only for backfill budget estimates, not billing truth.
 */
export const APPROX_USD_PER_1K_TOKENS = 0.00015 as const;
export const APPROX_TOKENS_PER_CHAR = 0.25 as const;
