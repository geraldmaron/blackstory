/**
 * User-facing copy for the /memorial edition. Dignity-first; incomplete by design.
 * The opening viewport is the wall; this file does not put a title or lede over it.
 */

export const MEMORIAL_PAGE_DESCRIPTION =
  'A memorial wall of names, written out one at a time, with the same names listed alphabetically underneath. The list is incomplete, and always will be.';

/**
 * "Held in the Wall" message: assembles from the wall's own handwriting
 * mechanic, one line at a time, then holds fixed at center permanently.
 * Approved copy. Do not rewrite without checking with product first.
 *
 * The "we" in the first line is the reader and the writer saying the names together, which is
 * what that line is for. It is not the project's first person, and the site-wide rule against
 * the publisher's "we" does not reach it.
 */
export const MEMORIAL_HELD_MESSAGE_LINES = [
  'We say their names because silence is how forgetting starts.',
  "Some of these names you know. Most of them, until now, you didn't.",
  'Every one is a reminder: the fight for equality is not over.',
  'This list will never be finished. That is not a flaw. It is the truth.',
] as const;

export const MEMORIAL_LIST_NOTE =
  'This list is incomplete and always will be. If a name belongs here and is missing, send the evidence through Submit, or write to me@geralddagher.com.';

export const MEMORIAL_QUIET_LIST_LINK_LABEL = 'Read every name';

/** Spoken name for the cue above, which is deliberately terse on screen. */
export const MEMORIAL_QUIET_LIST_LINK_A11Y_LABEL = 'Read every name held here';

/**
 * Deterministic seed for the wall's handwriting layout. The value still reads `v6` and is
 * deliberately unchanged: it is a seed, not a label, and rewriting the string would reshuffle
 * every name's position, size and ink on a memorial wall. It moved here from the route's
 * Reading-room styles own the memorial entry label.
 */
export const MEMORIAL_WALL_SEED = 'memorial-edition-v6';
