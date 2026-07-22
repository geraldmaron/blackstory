/**
 * Story rewrite artifact lane: batch rewrites for human review only.
 *
 * Resolves mock vs OpenRouter providers, writes JSON artifacts under
 * `.cache/story-rewrites/`, and never publishes seed corpus changes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { listSeedStoryProjections } from '@repo/domain';
import {
  createHybridLlmProvider,
  createLlmProvider,
  createOpenRouterLlmProvider,
  type CreateLlmProviderOptions,
  type LlmProvider,
} from './llm-provider.js';
import {
  DEFAULT_STORY_REWRITE_MODEL,
  DEFAULT_STORY_REWRITE_MODELS,
  rewriteStory,
  STORY_REWRITE_MIN_WORDS,
  type StoryProjection,
  type StoryRewriteResult,
  type PublicStorySection,
} from './story-rewrite.js';

export const STORY_REWRITE_ARTIFACT_DIR = '.cache/story-rewrites';

export type StoryRewriteLaneInput = {
  readonly slug?: string;
  readonly output?: string;
  readonly provider?: CreateLlmProviderOptions['provider'];
  readonly model?: string;
  readonly models?: readonly string[];
  readonly apiKey?: string;
};

export type StoryRewriteLaneSummary = {
  readonly outputDir: string;
  readonly providerId: string;
  readonly liveGeneration: boolean;
  readonly results: readonly StoryRewriteResult[];
};

const MOCK_MODEL_ID = 'mock-story-rewrite-v1';
const SECTION_HEADINGS = Object.freeze([
  'Place and premise',
  'Evidence on the record',
  'People, institutions, and consequences',
  'What to verify next',
]);

function wordCount(sections: readonly PublicStorySection[]): number {
  return sections
    .flatMap((section) => section.paragraphs)
    .join(' ')
    .split(/\s+/u)
    .filter(Boolean).length;
}

function expandParagraph(source: string, placeLabel: string, sourceLabel: string): string {
  const trimmed = source.trim();
  const lead =
    trimmed.length >= 40
      ? trimmed
      : `${trimmed} The archive keeps this detail tied to ${placeLabel} rather than a generic national summary.`;
  const tail =
    ` Readers can cross-check this passage against ${sourceLabel}. ` +
    'The rewrite lane preserves the supplied thesis, adds connective chronology where the ' +
    'seed prose already supports it, and avoids inventing quotations, motives, or statistics.';
  return `${lead}${tail}`.trim();
}

/** Deterministic mock expansion that satisfies 900-word / 4-section validation gates. */
export function buildMockStoryRewriteBody(story: StoryProjection): PublicStorySection[] {
  const seedParagraphs = story.body.flatMap((section) => section.paragraphs);
  const primarySource = story.sources[0]?.label ?? 'the cited archive sources';
  const sections: PublicStorySection[] = [];
  for (let index = 0; index < SECTION_HEADINGS.length; index += 1) {
    const heading = SECTION_HEADINGS[index]!;
    const paragraphs: string[] = [];
    while (wordCount([{ paragraphs }]) < Math.ceil(STORY_REWRITE_MIN_WORDS / 4)) {
      const seed = seedParagraphs[(sections.length + paragraphs.length) % Math.max(seedParagraphs.length, 1)] ??
        `${story.title} stays anchored to ${story.placeLabel} across ${story.eraLabel}.`;
      paragraphs.push(expandParagraph(seed, story.placeLabel, primarySource));
    }
    sections.push({ heading, paragraphs });
  }
  const verification =
    `Before treating this draft as publishable, verify names, dates, and claims against ` +
    `${story.sources.map((source) => source.label).join('; ')}. This mock artifact is for ` +
    'review workflow only; live Kimi K2.5 rewrites should replace it when OpenRouter credentials ' +
    'are available.';
  const last = sections[sections.length - 1]!;
  sections[sections.length - 1] = {
    ...(last.heading !== undefined ? { heading: last.heading } : {}),
    paragraphs: [...last.paragraphs, verification],
  };
  return sections;
}

export function createMockStoryRewriteProvider(modelId = MOCK_MODEL_ID): LlmProvider {
  return {
    id: 'mock',
    async complete(request) {
      const user = request.messages.find((message) => message.role === 'user')?.content ?? '{}';
      const parsed = JSON.parse(user) as {
        story?: StoryProjection & { existingBody?: StoryProjection['body'] };
      };
      const payload = parsed.story;
      if (!payload?.slug) {
        throw new Error('Mock story rewrite requires story.slug in the user payload');
      }
      const story: StoryProjection = {
        id: payload.slug,
        releaseId: 'rel_seed_001',
        slug: payload.slug,
        title: payload.title,
        dek: payload.dek,
        publishedAt: '2026-07-20',
        eraLabel: payload.eraLabel,
        placeLabel: payload.placeLabel,
        body: payload.body ?? payload.existingBody ?? [],
        relatedEntityIds: payload.relatedEntityIds ?? [],
        sources: payload.sources ?? [],
      };
      const body = buildMockStoryRewriteBody(story);
      return {
        content: JSON.stringify({ body }),
        provider: 'mock',
        modelId: request.model || modelId,
      };
    },
  };
}

export function hasOpenRouterCredentials(apiKey = process.env.OPENROUTER_API_KEY): boolean {
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

export function resolveStoryRewriteProvider(
  input: Pick<StoryRewriteLaneInput, 'provider' | 'model' | 'models' | 'apiKey'> = {},
): { readonly provider: LlmProvider; readonly liveGeneration: boolean } {
  const models = input.models ?? DEFAULT_STORY_REWRITE_MODELS;
  const requested = input.provider ?? process.env.STORY_REWRITE_LLM_PROVIDER ??
    process.env.EDITORIAL_LLM_PROVIDER;
  if (requested === 'mock') {
    return { provider: createMockStoryRewriteProvider(input.model), liveGeneration: false };
  }
  if (requested === 'ollama') {
    return {
      provider: createLlmProvider({ provider: 'ollama', ...(input.model ? { model: input.model } : {}) }),
      liveGeneration: true,
    };
  }
  if (requested === 'hybrid' && hasOpenRouterCredentials(input.apiKey)) {
    return {
      provider: createHybridLlmProvider({
        ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        models,
      }),
      liveGeneration: true,
    };
  }
  if (
    (requested === 'openrouter' || requested === 'hybrid' || requested === undefined) &&
    hasOpenRouterCredentials(input.apiKey)
  ) {
    return {
      provider: createOpenRouterLlmProvider({
        ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        models,
      }),
      liveGeneration: true,
    };
  }
  return { provider: createMockStoryRewriteProvider(input.model), liveGeneration: false };
}

export function writeStoryRewriteArtifact(
  result: StoryRewriteResult,
  outputDir: string,
): string {
  mkdirSync(outputDir, { recursive: true });
  const path = `${outputDir}/${result.slug}.json`;
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return path;
}

export async function runStoryRewriteLane(
  input: StoryRewriteLaneInput = {},
): Promise<StoryRewriteLaneSummary> {
  const outputDir = input.output ?? STORY_REWRITE_ARTIFACT_DIR;
  const stories = listSeedStoryProjections().filter((story) => !input.slug || story.slug === input.slug);
  if (stories.length === 0) {
    throw new Error(`No seed story matched ${input.slug ?? '(all)'}`);
  }
  const { provider, liveGeneration } = resolveStoryRewriteProvider(input);
  const model = input.model ?? process.env.STORY_REWRITE_MODEL ?? DEFAULT_STORY_REWRITE_MODEL;
  const results: StoryRewriteResult[] = [];
  for (const seed of stories) {
    const story: StoryProjection = {
      id: seed.id,
      releaseId: seed.releaseId,
      slug: seed.slug,
      title: seed.title,
      dek: seed.dek,
      publishedAt: seed.publishedAt,
      eraLabel: seed.eraLabel,
      placeLabel: seed.placeLabel,
      body: seed.body.map((section) => ({
        paragraphs: [...section.paragraphs],
        ...(section.heading !== undefined ? { heading: section.heading } : {}),
      })),
      relatedEntityIds: [...seed.relatedEntityIds],
      sources: seed.sources.map((source) => ({
        label: source.label,
        url: source.url,
      })),
    };
    const result = await rewriteStory(story, {
      provider,
      ...(liveGeneration ? { model } : {}),
    });
    writeStoryRewriteArtifact(result, outputDir);
    results.push(result);
  }
  return {
    outputDir,
    providerId: provider.id,
    liveGeneration,
    results: Object.freeze(results),
  };
}

export function formatStoryRewriteLaneResult(result: StoryRewriteResult, path: string): string {
  return JSON.stringify({
    slug: result.slug,
    modelId: result.modelId,
    words: result.wordCount,
    originalWords: result.originalWordCount,
    issues: result.validationIssues,
    path,
  });
}
