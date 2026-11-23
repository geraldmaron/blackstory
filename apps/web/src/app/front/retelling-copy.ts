/**
 * The retelling's sentences, one per scene (docs/ui/DESIGN.md section 9.7).
 *
 * Each says only what its word means. None is a claim about history, so none needs a source.
 * PROVISIONAL: first drafts, with two alternatives each in docs/ui/v13/retelling-copy.md, waiting
 * on the owner and a prose review (docs/ui/story.md, docs/content/neo-voice.md).
 */
import type { RetellingSceneId } from './retelling-scenes';

export const RETELLING_COPY_PROVISIONAL = true;

export const RETELLING_SENTENCES: Readonly<Partial<Record<RetellingSceneId, string>>> = {
  history: 'History is the record of what happened.',
  'his-story': 'His story is one man’s part of it.',
  'her-story': 'Her story is one woman’s part of it.',
  'your-story': 'Your story is the part nearest you.',
  'their-story': 'Their story is what many people made together.',
};

/** The brand line under the wordmark. Not provisional: it is the brand's own. */
export const RETELLING_TAGLINE = 'History, pinned to place.';

/** Scene 6: what the archive is, and what a dark place means. `total` is a formatted count. */
export function archiveSentence(total: string): string {
  return `BlackStory is an archive of ${total} sourced records of Black history in the United States, each pinned to the place it happened, and the dark places on this map are the ones not researched yet.`;
}
