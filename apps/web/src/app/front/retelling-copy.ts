/**
 * The retelling's sentences, one per scene (docs/ui/DESIGN.md section 9.7).
 *
 * Each says only what its word means. None is a claim about history, so none needs a source. The
 * first scene has none: it is the brand's own panel (the mark, the brand line and `archiveSentence`).
 * PROVISIONAL: first drafts, with two alternatives each in docs/ui/v13/retelling-copy.md, waiting
 * on the owner and a prose review (docs/ui/story.md, docs/content/neo-voice.md).
 */
import type { RetellingSceneId } from './retelling-scenes';

export const RETELLING_COPY_PROVISIONAL = true;

export const RETELLING_SENTENCES: Readonly<Partial<Record<RetellingSceneId, string>>> = {
  // The web's first screen is the brand panel and does not show this one. The app's opening
  // still does, and reads its words from here (apps/mobile/src/features/opening).
  history: 'History is the story that got told, so keep going and watch the word change.',
  'his-story': 'His story is one man’s part of it.',
  'her-story': 'Her story is one woman’s part of it.',
  'your-story': 'Your story is the part nearest you.',
  'their-story': 'Their story is what many people made together.',
};

/** The brand line under the wordmark. Not provisional: it is the brand's own. */
export const RETELLING_TAGLINE = 'History, pinned to place.';

/** Scene 1: what the archive is. `total` is a formatted count. */
export function archiveSentence(total: string): string {
  return `BlackStory is an archive of ${total} sourced records of Black history in the United States, each pinned to the place it happened.`;
}

/** Scene 1's two ways on: into the opening, or past it to the contents. */
export const FRONT_START = 'Start the opening';
export const FRONT_CONTENTS = 'See what is in the archive';

/** Scene 6: the line under the name once "Black History" has closed into it. */
export const RETELLING_CLOSING = 'It happened here.';
