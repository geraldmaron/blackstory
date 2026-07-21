/**
 * Pluggable LLM completion port for editorial/enrichment runs.
 *
 * Providers: `mock` (deterministic, no network), `openrouter` (OPENROUTER_API_KEY),
 * `ollama` (local OpenAI-compatible or native /api/chat), `hybrid` (OpenRouter primary
 * with Ollama failover). Never used on the public render path.
 */
export type LlmMessage = {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
};

export type LlmCompletionRequest = {
  readonly messages: readonly LlmMessage[];
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Provider-enforced JSON Schema. Structured tasks must supply this. */
  readonly responseSchema?: {
    readonly name: string;
    readonly schema: Readonly<Record<string, unknown>>;
  };
};

export type LlmCompletionResult = {
  readonly content: string;
  readonly provider: string;
  readonly modelId: string;
  /** When hybrid failover occurred, names the provider that actually answered. */
  readonly servedBy?: string;
  readonly attempts?: number;
};

export type LlmProvider = {
  readonly id: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
};

export type CreateLlmProviderOptions = {
  readonly provider?: 'mock' | 'openrouter' | 'ollama' | 'hybrid';
  readonly model?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  /** Ollama model used by hybrid failover (and default for provider=ollama). */
  readonly ollamaModel?: string;
  readonly fetchImpl?: typeof fetch;
  /** Max attempts per provider before failing (or failing over for hybrid). */
  readonly maxAttempts?: number;
  /** Optional OpenRouter roster; failures rotate through it in order. */
  readonly models?: readonly string[];
};

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
const DEFAULT_OLLAMA_MODEL = 'qwen3:8b';
const DEFAULT_MOCK_MODEL = 'mock-editorial-v1';

export function createMockLlmProvider(modelId = DEFAULT_MOCK_MODEL): LlmProvider {
  return {
    id: 'mock',
    async complete(request) {
      const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
      const titleMatch = /"title"\s*:\s*"([^"]+)"/.exec(user);
      const idMatch = /"subjectId"\s*:\s*"([^"]+)"/.exec(user);
      const title = titleMatch?.[1] ?? 'This record';
      const subjectId = idMatch?.[1] ?? 'ent_unknown';
      const summary =
        `${title} is a place-linked Black history record with documented evidence in the catalog. ` +
        `Readers can follow related people and places from this entry. Subject id ${subjectId} ` +
        `anchors learning without claiming completeness.`;
      const payload = {
        decision: 'keep',
        rationale: 'Mock provider: keep for staging; no live model call.',
        confidence: 0.55,
        drafts: {
          publicSummary: summary.slice(0, 400),
          historicalContext: `${title} sits in a documented historical context suitable for learning.`,
          relatedEntityIds: [] as string[],
          proposedRelationshipNotes: 'Suggest typed edges after human review of relatedEntityIds.',
        },
      };
      return {
        content: JSON.stringify(payload),
        provider: 'mock',
        modelId: request.model || modelId,
      };
    },
  };
}

type ChatMessagePayload = {
  readonly role?: string;
  readonly content?: string | null;
  readonly reasoning?: string | null;
  readonly thinking?: string | null;
};

/** Prefer message.content; fall back to reasoning/thinking (qwen3 OpenAI-compat quirk). */
export function extractMessageContent(message: ChatMessagePayload | undefined): string {
  const content = message?.content?.trim();
  if (content) return content;
  const reasoning = message?.reasoning?.trim() || message?.thinking?.trim();
  if (!reasoning) return '';
  return reasoning;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function completeOpenAiCompatible(
  providerId: string,
  baseUrl: string,
  apiKey: string | undefined,
  request: LlmCompletionRequest,
  fetchImpl: typeof fetch,
  extraBody: Record<string, unknown> = {},
): Promise<LlmCompletionResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://blackstory.local';
    headers['X-Title'] = 'BlackStory editorial staging';
  }
  const responseFormat = request.responseSchema
    ? {
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.responseSchema.name,
            strict: true,
            schema: request.responseSchema.schema,
          },
        },
      }
    : {};
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: request.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 900,
      messages: request.messages,
      ...responseFormat,
      ...extraBody,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    const err = new Error(
      `${providerId} completion failed (${response.status}): ${body.slice(0, 400)}`,
    ) as Error & { status?: number; retryable?: boolean };
    err.status = response.status;
    // A roster is tried model-by-model regardless of status (see createOpenRouterLlmProvider);
    // `retryable` here only controls whether a single-model caller backs off and retries.
    err.retryable = isRetryableStatus(response.status);
    throw err;
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: ChatMessagePayload }>;
    model?: string;
  };
  const content = extractMessageContent(json.choices?.[0]?.message);
  if (!content) {
    const err = new Error(`${providerId} returned empty completion content`) as Error & {
      retryable?: boolean;
    };
    err.retryable = true;
    throw err;
  }
  return {
    content,
    provider: providerId,
    modelId: typeof json.model === 'string' && json.model ? json.model : request.model,
  };
}

/**
 * Ollama native /api/chat — honors `think: false` so qwen3 writes to `message.content`
 * instead of burning tokens on reasoning under the OpenAI-compat shim.
 */
async function completeOllamaNative(
  baseUrl: string,
  request: LlmCompletionRequest,
  fetchImpl: typeof fetch,
): Promise<LlmCompletionResult> {
  const root = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
  const response = await fetchImpl(`${root}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      stream: false,
      think: false,
      options: {
        temperature: request.temperature ?? 0.2,
        num_predict: request.maxTokens ?? 900,
      },
      messages: request.messages,
      format: request.responseSchema?.schema ?? 'json',
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    const err = new Error(
      `ollama completion failed (${response.status}): ${body.slice(0, 400)}`,
    ) as Error & { status?: number; retryable?: boolean };
    err.status = response.status;
    err.retryable = isRetryableStatus(response.status);
    throw err;
  }
  const json = (await response.json()) as {
    message?: ChatMessagePayload;
    model?: string;
  };
  const content = extractMessageContent(json.message);
  if (!content) {
    const err = new Error('ollama returned empty completion content') as Error & {
      retryable?: boolean;
    };
    err.retryable = true;
    throw err;
  }
  return {
    content,
    provider: 'ollama',
    modelId: typeof json.model === 'string' && json.model ? json.model : request.model,
  };
}

async function withRetries(
  label: string,
  maxAttempts: number,
  run: () => Promise<LlmCompletionResult>,
): Promise<LlmCompletionResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await run();
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof Error &&
        'retryable' in error &&
        (error as { retryable?: boolean }).retryable === true;
      if (!retryable || attempt >= maxAttempts) break;
      await sleep(Math.min(8_000, 400 * 2 ** (attempt - 1)));
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} failed after ${maxAttempts} attempt(s): ${message}`);
}

/**
 * Free-model rotation roster: when `OPENROUTER_MODELS` (comma-separated) is set, a
 * retryable failure on one model (429/5xx/empty) rotates to the next instead of
 * burning every attempt on a single rate-limited free router.
 */
export function resolveOpenRouterModels(options: {
  readonly model?: string;
  readonly models?: readonly string[];
}): readonly string[] {
  if (options.models && options.models.length > 0) return options.models;
  const fromEnv = process.env.OPENROUTER_MODELS?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return [options.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL];
}

export function createOpenRouterLlmProvider(options: {
  readonly apiKey?: string;
  readonly model?: string;
  readonly models?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly maxAttempts?: number;
}): LlmProvider {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is required for provider=openrouter (use run-with-dev-secrets)',
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const models = resolveOpenRouterModels(options);
  const maxAttempts = options.maxAttempts ?? Math.max(3, models.length);
  return {
    id: 'openrouter',
    async complete(request) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // A caller-pinned model stays pinned; otherwise rotate through the roster.
        const model = request.model || models[(attempt - 1) % models.length]!;
        try {
          const result = await completeOpenAiCompatible(
            'openrouter',
            'https://openrouter.ai/api/v1',
            apiKey,
            { ...request, model },
            fetchImpl,
          );
          return { ...result, attempts: attempt };
        } catch (error) {
          lastError = error;
          if (attempt >= maxAttempts) break;
          // A different model next is a fresh attempt regardless of error kind — a 400
          // "this model doesn't support X" from one router says nothing about the next
          // one, so don't gate rotation on `retryable` (that flag only means "worth
          // retrying the SAME endpoint"). Only back off when about to repeat a model.
          const nextModel = request.model || models[attempt % models.length]!;
          if (nextModel === model) {
            const retryable =
              error instanceof Error &&
              'retryable' in error &&
              (error as { retryable?: boolean }).retryable === true;
            if (!retryable) break;
            await sleep(Math.min(8_000, 400 * 2 ** (attempt - 1)));
          }
        }
      }
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`openrouter failed after ${maxAttempts} attempt(s): ${message}`);
    },
  };
}

export function createOllamaLlmProvider(options: {
  readonly baseUrl?: string;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
  readonly maxAttempts?: number;
}): LlmProvider {
  const baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1';
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaultModel = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
  const maxAttempts = options.maxAttempts ?? 2;
  return {
    id: 'ollama',
    complete(request) {
      return withRetries('ollama', maxAttempts, () =>
        completeOllamaNative(
          baseUrl,
          { ...request, model: request.model || defaultModel },
          fetchImpl,
        ),
      );
    },
  };
}

function looksLikeJsonObject(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Explicit OpenRouter model roster first; on failure or invalid JSON, Ollama on Corsair/local.
 * Records `servedBy` so overnight reports show which lane answered.
 */
export function createHybridLlmProvider(options: {
  readonly apiKey?: string;
  readonly model?: string;
  readonly ollamaModel?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly maxAttempts?: number;
  readonly models?: readonly string[];
}): LlmProvider {
  const openrouter = createOpenRouterLlmProvider({
    ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.models !== undefined ? { models: options.models } : {}),
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    maxAttempts: options.maxAttempts ?? 2,
  });
  const ollama = createOllamaLlmProvider({
    ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
    model: options.ollamaModel ?? process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    maxAttempts: options.maxAttempts ?? 2,
  });
  return {
    id: 'hybrid',
    async complete(request) {
      try {
        // Pass the model through untouched: empty lets the OpenRouter provider
        // rotate its roster instead of pinning the single default router.
        const primary = await openrouter.complete(request);
        if (!looksLikeJsonObject(primary.content)) {
          throw Object.assign(new Error('openrouter returned non-JSON content'), {
            retryable: true,
          });
        }
        return { ...primary, provider: 'hybrid', servedBy: 'openrouter' };
      } catch (primaryError) {
        try {
          const fallback = await ollama.complete({
            ...request,
            model: options.ollamaModel ?? process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
          });
          if (!looksLikeJsonObject(fallback.content)) {
            throw new Error('ollama returned non-JSON content', { cause: primaryError });
          }
          return { ...fallback, provider: 'hybrid', servedBy: 'ollama' };
        } catch (fallbackError) {
          const primaryMsg =
            primaryError instanceof Error ? primaryError.message : String(primaryError);
          const fallbackMsg =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(
            `hybrid failed (openrouter: ${primaryMsg.slice(0, 200)}; ollama: ${fallbackMsg.slice(0, 200)})`,
            { cause: fallbackError },
          );
        }
      }
    },
  };
}

export function createLlmProvider(options: CreateLlmProviderOptions = {}): LlmProvider {
  const provider =
    options.provider ??
    (process.env.EDITORIAL_LLM_PROVIDER as CreateLlmProviderOptions['provider']) ??
    'mock';
  switch (provider) {
    case 'openrouter':
      return createOpenRouterLlmProvider({
        ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.models !== undefined ? { models: options.models } : {}),
        ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
        ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
      });
    case 'ollama':
      return createOllamaLlmProvider({
        ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
        ...(options.ollamaModel !== undefined
          ? { model: options.ollamaModel }
          : options.model !== undefined
            ? { model: options.model }
            : {}),
        ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
        ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
      });
    case 'hybrid':
      return createHybridLlmProvider({
        ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.models !== undefined ? { models: options.models } : {}),
        ...(options.ollamaModel !== undefined ? { ollamaModel: options.ollamaModel } : {}),
        ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
        ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
        ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
      });
    case 'mock':
    default:
      return createMockLlmProvider(options.model ?? DEFAULT_MOCK_MODEL);
  }
}
