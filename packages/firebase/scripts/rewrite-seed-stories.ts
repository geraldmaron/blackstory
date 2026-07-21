/** Generate source-bound rewrite artifacts for human review; never publishes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { listSeedStoryProjections } from '../src/firestore/public-story-seed.ts';
import { createLlmProvider } from '../../operator-cli/src/llm-provider.ts';
import { DEFAULT_STORY_REWRITE_MODEL, rewriteStory } from '../../operator-cli/src/story-rewrite.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const slug = arg('--slug');
const output = arg('--output') ?? '.cache/story-rewrites';
const requestedProvider = arg('--provider');
const providerName =
  (requestedProvider as 'mock' | 'openrouter' | 'ollama' | 'hybrid' | undefined) ??
  (process.env.EDITORIAL_LLM_PROVIDER as 'mock' | 'openrouter' | 'ollama' | 'hybrid' | undefined) ??
  'openrouter';
const model = arg('--model') ?? process.env.STORY_REWRITE_MODEL ?? DEFAULT_STORY_REWRITE_MODEL;
const stories = listSeedStoryProjections().filter((story) => !slug || story.slug === slug);
if (stories.length === 0) throw new Error(`No seed story matched ${slug ?? '(all)'}`);

const provider = createLlmProvider({ provider: providerName, model });
mkdirSync(output, { recursive: true });
for (const story of stories) {
  const result = await rewriteStory(story, { provider, model });
  const path = `${output}/${story.slug}.json`;
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify({
      slug: result.slug,
      modelId: result.modelId,
      words: result.wordCount,
      issues: result.validationIssues,
      path,
    }),
  );
}
