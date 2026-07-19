/**
 * Pluggable LLM completion port for editorial/enrichment runs.
 *
 * Providers: `mock` (deterministic, no network), `openrouter` (OPENROUTER_API_KEY),
 * `ollama` (local OpenAI-compatible). Never used on the public render path.
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
};

export type LlmCompletionResult = {
  readonly content: string;
  readonly provider: string;
  readonly modelId: string;
};

export type LlmProvider = {
  readonly id: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
};

export type CreateLlmProviderOptions = {
  readonly provider?: 'mock' | 'openrouter' | 'ollama';
  readonly model?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
};

const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';
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

async function completeOpenAiCompatible(
  providerId: string,
  baseUrl: string,
  apiKey: string | undefined,
  request: LlmCompletionRequest,
  fetchImpl: typeof fetch,
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
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: request.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 900,
      messages: request.messages,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${providerId} completion failed (${response.status}): ${body.slice(0, 400)}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error(`${providerId} returned empty completion content`);
  }
  return { content, provider: providerId, modelId: request.model };
}

export function createOpenRouterLlmProvider(options: {
  readonly apiKey?: string;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
}): LlmProvider {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for provider=openrouter (use run-with-dev-secrets)');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaultModel = options.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  return {
    id: 'openrouter',
    complete(request) {
      return completeOpenAiCompatible(
        'openrouter',
        'https://openrouter.ai/api/v1',
        apiKey,
        { ...request, model: request.model || defaultModel },
        fetchImpl,
      );
    },
  };
}

export function createOllamaLlmProvider(options: {
  readonly baseUrl?: string;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
}): LlmProvider {
  const baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1';
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaultModel = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
  return {
    id: 'ollama',
    complete(request) {
      return completeOpenAiCompatible(
        'ollama',
        baseUrl,
        undefined,
        { ...request, model: request.model || defaultModel },
        fetchImpl,
      );
    },
  };
}

export function createLlmProvider(options: CreateLlmProviderOptions = {}): LlmProvider {
  const provider = options.provider ?? (process.env.EDITORIAL_LLM_PROVIDER as CreateLlmProviderOptions['provider']) ?? 'mock';
  switch (provider) {
    case 'openrouter':
      return createOpenRouterLlmProvider({
        ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
      });
    case 'ollama':
      return createOllamaLlmProvider({
        ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
      });
    case 'mock':
    default:
      return createMockLlmProvider(options.model ?? DEFAULT_MOCK_MODEL);
  }
}
