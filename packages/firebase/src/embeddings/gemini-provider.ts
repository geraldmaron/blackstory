/**
 * Real gemini-embedding-001 provider, built on the official `@google/genai` client.
 *
 * Uses the Gemini Developer API (API-key auth), not Vertex AI ADR-014 explicitly rejects
 * Vertex AI *Vector Search* for the index itself (always-on per-node cost floor), and this
 * keeps the embedding *call* on the same minimal, non-Vertex surface rather than pulling in
 * Vertex project/location plumbing this project otherwise avoids.
 *
 * The API key is read from environment/secret-manager-injected env vars only never
 * hardcoded, and never required at import time (only when `.embed` is actually invoked), so
 * this module is safe to import in environments without network access or a live key (tests
 * use `createDeterministicMockEmbeddingProvider` from ./provider.js instead).
 */
import { GoogleGenAI } from '@google/genai';
import type { EnvironmentLike } from '../guard.js';
import { EMBEDDING_DIMS, EMBEDDING_MODEL } from './constants.js';
import { EmbeddingProviderError, type EmbeddingProvider } from './provider.js';

/** Minimal structural slice of the SDK client this module actually calls keeps tests cheap. */
export type GeminiEmbedContentClient = {
  models: {
    embedContent(params: {
      readonly model: string;
      readonly contents: readonly string[];
      readonly config?: { readonly outputDimensionality?: number; readonly taskType?: string };
    }): Promise<{ readonly embeddings?: ReadonlyArray<{ readonly values?: number[] }> }>;
  };
};

export type GeminiEmbeddingProviderOptions = {
  readonly environment?: EnvironmentLike;
  readonly model?: string;
  /** Requests server-side truncation too; the pipeline still truncates+renormalizes locally. */
  readonly outputDimensionality?: number;
  /** Injectable for tests defaults to a real `GoogleGenAI` client built from the API key. */
  readonly clientFactory?: (apiKey: string) => GeminiEmbedContentClient;
};

const API_KEY_ENV_VARS = ['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY'] as const;

function resolveApiKey(environment: EnvironmentLike): string {
  for (const key of API_KEY_ENV_VARS) {
    const value = environment[key];
    if (value && value.trim()) return value.trim();
  }
  throw new EmbeddingProviderError(
    `Missing embedding API key: set one of ${API_KEY_ENV_VARS.join(', ')} (see .env.example). ` +
      'Never hardcode this value — it must come from Secret Manager / injected env, per repo convention.',
  );
}

function defaultClientFactory(apiKey: string): GeminiEmbedContentClient {
  return new GoogleGenAI({ apiKey }) as unknown as GeminiEmbedContentClient;
}

/**
 * Creates a provider that calls the real Gemini Developer API. Construction never touches the
 * network or throws for a missing key the key is resolved and the client is built lazily on
 * the first `.embed` call, so importing/wiring this module is always safe.
 */
export function createGeminiEmbeddingProvider(
  options: GeminiEmbeddingProviderOptions = {},
): EmbeddingProvider {
  const environment = options.environment ?? process.env;
  const model = options.model ?? EMBEDDING_MODEL;
  const outputDimensionality = options.outputDimensionality ?? EMBEDDING_DIMS;
  const clientFactory = options.clientFactory ?? defaultClientFactory;
  let client: GeminiEmbedContentClient | undefined;

  return {
    model,
    async embed(texts) {
      if (texts.length === 0) return [];
      if (!client) {
        client = clientFactory(resolveApiKey(environment));
      }
      let response: { readonly embeddings?: ReadonlyArray<{ readonly values?: number[] }> };
      try {
        response = await client.models.embedContent({
          model,
          contents: texts,
          config: { outputDimensionality, taskType: 'SEMANTIC_SIMILARITY' },
        });
      } catch (error) {
        throw new EmbeddingProviderError(`Gemini embedContent call failed for model "${model}"`, {
          cause: error,
        });
      }
      const embeddings = response.embeddings ?? [];
      if (embeddings.length !== texts.length) {
        throw new EmbeddingProviderError(
          `Gemini embedContent returned ${embeddings.length} embeddings for ${texts.length} inputs`,
        );
      }
      return embeddings.map((embedding, index) => {
        const values = embedding.values;
        if (!values || values.length === 0) {
          throw new EmbeddingProviderError(
            `Gemini embedContent returned no values at index ${index}`,
          );
        }
        return values;
      });
    },
  };
}
