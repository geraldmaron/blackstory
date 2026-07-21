/** Source-bound long-form rewrite lane. Artifacts only; never publishes the seed corpus. */
import {
  publicStoryProjectionSchema,
  type PublicStoryProjectionDoc,
  type PublicStorySectionDoc,
} from '@repo/firebase';
import type { LlmProvider } from './llm-provider.js';

export const DEFAULT_STORY_REWRITE_MODEL = 'moonshotai/kimi-k2.5';
export const DEFAULT_STORY_REWRITE_MODELS = Object.freeze([
  'moonshotai/kimi-k2.5',
  'qwen/qwen3.5-122b-a10b',
  'deepseek/deepseek-v3.2',
  'mistralai/mistral-medium-3.1',
]);
export const STORY_REWRITE_MIN_WORDS = 900;

export type StoryRewriteDraft = Pick<
  PublicStoryProjectionDoc,
  | 'slug'
  | 'title'
  | 'dek'
  | 'publishedAt'
  | 'eraLabel'
  | 'placeLabel'
  | 'body'
  | 'relatedEntityIds'
  | 'sources'
>;

export type StoryRewriteResult = {
  readonly slug: string;
  readonly modelId: string;
  readonly draft: StoryRewriteDraft;
  readonly originalWordCount: number;
  readonly wordCount: number;
  readonly validationIssues: readonly string[];
  readonly rawModelContent: string;
};

type ModelResponse = { readonly body?: unknown };

const SYSTEM_PROMPT = `You are the long-form editorial writer for BlackStory (History, pinned to place).
Return ONLY JSON with one key: body.
body must be an array of 4 to 6 objects. Each object has an optional heading and a paragraphs array.
Write 900 to 1500 words of clear, human prose for the supplied story.

Editorial rules:
- Preserve the supplied title, dek, era, place, related entities, and source list; write only body.
- Use only facts supported by the supplied source labels and URLs or explicitly supplied existing prose.
- Do not invent quotations, dates, names, statistics, motives, or source details.
- If a detail cannot be supported, leave it out or qualify it plainly.
- Keep the existing thesis and place-first start-line relocation, but add connective tissue,
  chronology, people, institutions, and consequences where the evidence supports them.
- Evidence before assertion. Avoid trauma-forward hooks, sweeping claims, present-day partisan bait,
  anonymous people, and language that turns Black history into spectacle.
- End with a concise verification/off-ramp paragraph that tells the reader what to check.
- No markdown, bracket citations, preamble, or commentary outside the JSON object.`;

function wordCount(sections: readonly PublicStorySectionDoc[]): number {
  return sections
    .flatMap((section) => section.paragraphs)
    .join(' ')
    .split(/\s+/u)
    .filter(Boolean).length;
}

function parseBody(content: string): PublicStorySectionDoc[] {
  const trimmed = content.trim();
  let parsed: ModelResponse;
  try {
    parsed = JSON.parse(trimmed) as ModelResponse;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Story rewrite was not valid JSON');
    parsed = JSON.parse(trimmed.slice(start, end + 1)) as ModelResponse;
  }
  if (!Array.isArray(parsed.body)) throw new Error('Story rewrite JSON did not contain body[]');
  return parsed.body.map((section, index) => {
    if (!section || typeof section !== 'object') {
      throw new Error(`Story rewrite section ${index + 1} was not an object`);
    }
    const candidate = section as { heading?: unknown; paragraphs?: unknown };
    if (!Array.isArray(candidate.paragraphs) || candidate.paragraphs.length === 0) {
      throw new Error(`Story rewrite section ${index + 1} has no paragraphs`);
    }
    const paragraphs = candidate.paragraphs.map((paragraph, paragraphIndex) => {
      if (typeof paragraph !== 'string' || paragraph.trim().length < 40) {
        throw new Error(`Story rewrite paragraph ${index + 1}.${paragraphIndex + 1} is too short`);
      }
      return paragraph.trim();
    });
    const heading = typeof candidate.heading === 'string' ? candidate.heading.trim() : undefined;
    return { ...(heading ? { heading } : {}), paragraphs } satisfies PublicStorySectionDoc;
  });
}

export function validateStoryRewrite(
  original: Pick<PublicStoryProjectionDoc, 'body'>,
  draft: Pick<PublicStoryProjectionDoc, 'body'>,
): readonly string[] {
  const count = wordCount(draft.body);
  const originalCount = wordCount(original.body);
  const issues: string[] = [];
  if (draft.body.length < 4) issues.push('body must contain at least four sections');
  if (count < STORY_REWRITE_MIN_WORDS) {
    issues.push(`body is ${count} words; minimum is ${STORY_REWRITE_MIN_WORDS}`);
  }
  if (count < originalCount * 2) {
    issues.push(`body is not at least twice the original length (${originalCount} words)`);
  }
  if (
    draft.body.some((section) => section.paragraphs.some((paragraph) => paragraph.length > 1800))
  ) {
    issues.push('body contains a paragraph over 1800 characters');
  }
  return Object.freeze(issues);
}

export async function rewriteStory(
  story: PublicStoryProjectionDoc,
  input: { readonly provider: LlmProvider; readonly model?: string },
): Promise<StoryRewriteResult> {
  const completion = await input.provider.complete({
    // Empty lets OpenRouter rotate the configured quality roster. An explicit
    // model remains a deliberate pin for reproducible experiments.
    model: input.model ?? '',
    temperature: 0.45,
    maxTokens: 2400,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          story: {
            slug: story.slug,
            title: story.title,
            dek: story.dek,
            eraLabel: story.eraLabel,
            placeLabel: story.placeLabel,
            existingBody: story.body,
            sources: story.sources,
          },
        }),
      },
    ],
  });
  const body = parseBody(completion.content);
  const schemaResult = publicStoryProjectionSchema.safeParse({
    id: story.id,
    releaseId: story.releaseId,
    slug: story.slug,
    title: story.title,
    dek: story.dek,
    publishedAt: story.publishedAt,
    eraLabel: story.eraLabel,
    placeLabel: story.placeLabel,
    body,
    relatedEntityIds: story.relatedEntityIds,
    sources: story.sources,
  });
  if (!schemaResult.success) {
    throw new Error(`Story rewrite failed public schema validation: ${schemaResult.error.message}`);
  }
  return {
    slug: story.slug,
    modelId: completion.modelId,
    draft: {
      slug: story.slug,
      title: story.title,
      dek: story.dek,
      publishedAt: story.publishedAt,
      eraLabel: story.eraLabel,
      placeLabel: story.placeLabel,
      body,
      relatedEntityIds: story.relatedEntityIds,
      sources: story.sources,
    },
    originalWordCount: wordCount(story.body),
    wordCount: wordCount(body),
    validationIssues: validateStoryRewrite(story, { body }),
    rawModelContent: completion.content,
  };
}
