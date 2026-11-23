/**
 * The opening: the web front page's six scenes (History, His story, Her story, Your story, Their
 * story, BlackStory) as six swipeable pages (docs/ui/DESIGN.md sections 9.7 and 11).
 *
 * PROVISIONAL, as on the web: the three record picks and the scene sentences are first drafts
 * the owner has not chosen (DESIGN.md section 15, the phase 7 item). They are the web's own
 * values (`apps/web/src/app/front/retelling-picks.ts`, `retelling-copy.ts`); a test holds the
 * two together, so a change there fails here until it is carried over.
 *
 * shortcut: copied, because the app cannot import from the web app. Move the picks and the copy
 * into `packages/public-contracts` when the owner settles them.
 */
export const OPENING_PROVISIONAL = true;

export type OpeningSceneId =
  'history' | 'his-story' | 'her-story' | 'your-story' | 'their-story' | 'black-story';

export type OpeningSceneKind = 'word' | 'record' | 'town' | 'country';

export type OpeningScene = {
  readonly id: OpeningSceneId;
  /** The whole heading, as a screen reader says it. */
  readonly heading: string;
  /** The word the heading turns on, set in italic. Empty for History and BlackStory. */
  readonly prefix: string;
  readonly kind: OpeningSceneKind;
  /** One sentence that says only what the word means. Provisional. */
  readonly sentence?: string;
  /** The record this scene shows, by id. Provisional. */
  readonly recordId?: string;
};

export const OPENING_SCENES: readonly OpeningScene[] = [
  {
    id: 'history',
    heading: 'History',
    prefix: '',
    kind: 'word',
    sentence: 'History is the record of what happened.',
  },
  {
    id: 'his-story',
    heading: 'His story',
    prefix: 'His',
    kind: 'record',
    sentence: 'His story is one man’s part of it.',
    recordId: 'nrhp-black-heritage-78000950',
  },
  {
    id: 'her-story',
    heading: 'Her story',
    prefix: 'Her',
    kind: 'record',
    sentence: 'Her story is one woman’s part of it.',
    recordId: 'nrhp-black-heritage-74001222',
  },
  {
    id: 'your-story',
    heading: 'Your story',
    prefix: 'Your',
    kind: 'town',
    sentence: 'Your story is the part nearest you.',
  },
  {
    id: 'their-story',
    heading: 'Their story',
    prefix: 'Their',
    kind: 'record',
    sentence: 'Their story is what many people made together.',
    recordId: 'nrhp-black-heritage-05000149',
  },
  { id: 'black-story', heading: 'BlackStory', prefix: '', kind: 'country' },
];

/** The brand line under the wordmark. Not provisional. */
export const OPENING_TAGLINE = 'History, pinned to place.';

/**
 * The archive's one sentence. The web's carries the count of published records; the app loads no
 * such count (only how many records have a point on the map, which is a different number), so
 * it says the rest and leaves the number out. Provisional.
 */
export const OPENING_ARCHIVE_SENTENCE =
  'BlackStory is an archive of sourced records of Black history in the United States, each pinned to the place it happened, and the dark places on the map are the ones not researched yet.';

export const OPENING_SKIP_LABEL = 'Skip to the archive';
export const OPENING_TOWN_PROMPT = 'Type a town.';
