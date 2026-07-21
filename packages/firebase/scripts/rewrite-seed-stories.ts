/** Generate source-bound rewrite artifacts for human review; never publishes. */
import {
  formatStoryRewriteLaneResult,
  runStoryRewriteLane,
  STORY_REWRITE_ARTIFACT_DIR,
} from '../../operator-cli/src/story-rewrite-lane.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const slug = arg('--slug');
const output = arg('--output') ?? STORY_REWRITE_ARTIFACT_DIR;
const requestedProvider = arg('--provider') as
  | 'mock'
  | 'openrouter'
  | 'ollama'
  | 'hybrid'
  | undefined;
const requestedModels = arg('--models')
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const model = arg('--model') ?? process.env.STORY_REWRITE_MODEL;

const summary = await runStoryRewriteLane({
  ...(slug !== undefined ? { slug } : {}),
  output,
  ...(requestedProvider !== undefined ? { provider: requestedProvider } : {}),
  ...(model !== undefined ? { model } : {}),
  ...(requestedModels !== undefined ? { models: requestedModels } : {}),
});

if (!summary.liveGeneration) {
  console.error(
    'Using mock story rewrite provider (no OPENROUTER_API_KEY). ' +
      'For live Kimi K2.5 rewrites: run-with-dev-secrets -- STORY_REWRITE_LLM_PROVIDER=openrouter ' +
      'node --conditions development --import tsx packages/firebase/scripts/rewrite-seed-stories.ts',
  );
}

for (const result of summary.results) {
  const path = `${summary.outputDir}/${result.slug}.json`;
  console.log(formatStoryRewriteLaneResult(result, path));
}
