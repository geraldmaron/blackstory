import {
  EmbeddingProviderError,
  type EmbeddingProvider,
} from '../../packages/ops-data/src/embeddings/provider.ts';

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const REQUEST_TIMEOUT_MS = 60_000;
const RESPONSE_MODEL_NORMALIZATIONS: Readonly<Record<string, string>> = {
  'openai/text-embedding-3-small': 'text-embedding-3-small',
};

export type OpenRouterEmbeddingUsage = {
  readonly responseModel: string;
  readonly promptTokens: number | null;
  readonly totalTokens: number | null;
  /** OpenRouter reports usage.cost in USD-denominated credits. */
  readonly costUsd: number | null;
};

export type OpenRouterEvaluationEmbeddingProviderOptions = {
  readonly apiKey: string;
  readonly model: string;
  readonly dimensions: number;
  readonly fetchImpl?: typeof fetch;
  readonly onUsage?: (usage: OpenRouterEmbeddingUsage) => void;
};

type OpenRouterEmbeddingResponse = {
  readonly model?: unknown;
  readonly data?: unknown;
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly total_tokens?: unknown;
    readonly cost?: unknown;
  };
};

function optionalNonnegativeNumber(value: unknown, name: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EmbeddingProviderError(`OpenRouter returned invalid ${name}`);
  }
  return value;
}

function parseVectors(
  data: unknown,
  inputCount: number,
  dimensions: number,
): readonly (readonly number[])[] {
  if (!Array.isArray(data) || data.length !== inputCount) {
    throw new EmbeddingProviderError(
      `OpenRouter returned ${Array.isArray(data) ? data.length : 'no'} embeddings for ${inputCount} inputs`,
    );
  }

  const ordered = new Array<readonly number[]>(inputCount);
  for (const item of data) {
    if (!item || typeof item !== 'object') {
      throw new EmbeddingProviderError('OpenRouter returned a malformed embedding row');
    }
    const { index, embedding } = item as { readonly index?: unknown; readonly embedding?: unknown };
    if (!Number.isSafeInteger(index) || (index as number) < 0 || (index as number) >= inputCount) {
      throw new EmbeddingProviderError('OpenRouter returned an invalid embedding index');
    }
    if (ordered[index as number] !== undefined) {
      throw new EmbeddingProviderError(`OpenRouter returned duplicate embedding index ${index}`);
    }
    if (
      !Array.isArray(embedding) ||
      embedding.length !== dimensions ||
      embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))
    ) {
      throw new EmbeddingProviderError(
        `OpenRouter embedding ${index} must contain exactly ${dimensions} finite values`,
      );
    }
    ordered[index as number] = embedding as number[];
  }
  if (ordered.some((vector) => vector === undefined)) {
    throw new EmbeddingProviderError('OpenRouter response omitted an embedding index');
  }
  return ordered;
}

export function createOpenRouterEvaluationEmbeddingProvider(
  options: OpenRouterEvaluationEmbeddingProviderOptions,
): EmbeddingProvider {
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const dimensions = options.dimensions;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) throw new EmbeddingProviderError('OPENROUTER_API_KEY is required');
  if (!model) throw new EmbeddingProviderError('OpenRouter embedding model is required');
  if (!Number.isSafeInteger(dimensions) || dimensions <= 0) {
    throw new EmbeddingProviderError('OpenRouter embedding dimensions must be a positive integer');
  }

  return {
    model,
    async embed(texts) {
      if (texts.length === 0) return [];
      let response: Response;
      try {
        response = await fetchImpl(OPENROUTER_EMBEDDINGS_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://blackstory.app',
            'X-OpenRouter-Title': 'BlackStory held-out retrieval evaluation',
          },
          body: JSON.stringify({
            model,
            input: texts,
            dimensions,
            encoding_format: 'float',
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        throw new EmbeddingProviderError('OpenRouter embedding request failed before a response', {
          cause: error,
        });
      }
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 400);
        throw new EmbeddingProviderError(
          `OpenRouter embeddings failed (${response.status}): ${detail}`,
        );
      }

      let payload: OpenRouterEmbeddingResponse;
      try {
        payload = (await response.json()) as OpenRouterEmbeddingResponse;
      } catch (error) {
        throw new EmbeddingProviderError('OpenRouter returned malformed embedding JSON', {
          cause: error,
        });
      }
      const responseModel = typeof payload.model === 'string' ? payload.model : '';
      if (responseModel !== model && RESPONSE_MODEL_NORMALIZATIONS[model] !== responseModel) {
        throw new EmbeddingProviderError(
          `OpenRouter returned model ${JSON.stringify(payload.model)} for requested model ${JSON.stringify(model)}`,
        );
      }
      const vectors = parseVectors(payload.data, texts.length, dimensions);
      const promptTokens = optionalNonnegativeNumber(
        payload.usage?.prompt_tokens,
        'usage.prompt_tokens',
      );
      const totalTokens = optionalNonnegativeNumber(
        payload.usage?.total_tokens,
        'usage.total_tokens',
      );
      const costUsd = optionalNonnegativeNumber(payload.usage?.cost, 'usage.cost');
      options.onUsage?.({ responseModel, promptTokens, totalTokens, costUsd });
      return vectors;
    },
  };
}
