/**
 * Embedding provider abstraction. Everything downstream (the pipeline, the backfill
 * CLI, the gold-corpus eval) depends on this interface, not on any specific SDK that's the
 * "control over model, dims, retries" the pre-GA `firestore-vector-search` extension can't give
 * us. `gemini-provider.ts` implements it against the real API; `createDeterministicMockEmbeddingProvider`
 * below implements it for tests/CI without any network access.
 */

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    readonly options: { readonly cause?: unknown; readonly attempts?: number } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'EmbeddingProviderError';
  }
}

export type EmbeddingProvider = {
  readonly model: string;
  /** Raw (pre-truncation, pre-normalization) embedding vectors, one per input text, in order. */
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
};

export type RetryOptions = {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  /** Injectable for deterministic tests defaults to a real setTimeout-based sleep. */
  readonly sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a provider with bounded exponential-backoff retries. Retries the whole batch call
 * gemini-embedding-001 batches are small enough (one entity's text per call) that partial-retry
 * bookkeeping isn't worth the complexity.
 */
export function createRetryingEmbeddingProvider(
  provider: EmbeddingProvider,
  options: RetryOptions = {},
): EmbeddingProvider {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new EmbeddingProviderError('maxAttempts must be a positive integer');
  }

  return {
    model: provider.model,
    async embed(texts) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await provider.embed(texts);
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            const delay = baseDelayMs * 2 ** (attempt - 1);
            await sleep(delay);
          }
        }
      }
      throw new EmbeddingProviderError(
        `Embedding provider "${provider.model}" failed after ${maxAttempts} attempts`,
        { cause: lastError, attempts: maxAttempts },
      );
    },
  };
}

function stableStringHash(value: string): number {
  // FNV-1a fast, dependency-free, and stable across Node versions.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** xorshift32 small, deterministic, seedable PRNG (not cryptographic; not meant to be). */
function makeSeededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export type MockEmbeddingProviderOptions = {
  readonly dims?: number;
  readonly model?: string;
};

/**
 * Deterministic, dependency-free fake embedding provider for tests and CI. It hashes each input
 * text to seed a PRNG and produces a stable pseudo-random vector NOT a semantically meaningful
 * embedding. Two different texts get uncorrelated (near-orthogonal) vectors; the *same* text
 * always gets the *same* vector. This is sufficient to exercise the pipeline's plumbing
 * (truncation, normalization, storage, KNN ranking, recall computation) end-to-end without
 * network access or an API key. A real recall number requires `createGeminiEmbeddingProvider`
 * with a live `GEMINI_API_KEY` see docs/adr/ADR-014-vector-search.md.
 */
export function createDeterministicMockEmbeddingProvider(
  options: MockEmbeddingProviderOptions = {},
): EmbeddingProvider {
  const dims = options.dims ?? 3072;
  const model = options.model ?? 'mock-deterministic-embedding';

  return {
    model,
    async embed(texts) {
      return texts.map((text) => {
        const random = makeSeededRandom(stableStringHash(text));
        const vector: number[] = new Array(dims);
        for (let index = 0; index < dims; index += 1) {
          vector[index] = random() * 2 - 1;
        }
        return vector;
      });
    },
  };
}
