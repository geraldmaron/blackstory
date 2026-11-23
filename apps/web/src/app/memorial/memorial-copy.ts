/**
 * User-facing copy for the /memorial edition. Dignity-first; incomplete by design.
 * The opening viewport is the wall; this file does not put a title or lede over it.
 */

export const MEMORIAL_PAGE_DESCRIPTION =
  'A memorial wall of names, written out one at a time, with the same names listed alphabetically underneath. The list is incomplete, and always will be.';

/**
 * "Held in the Wall" message: assembles from the wall's own handwriting
 * mechanic, one line at a time, then holds fixed at center permanently.
 * Owner-approved copy, rewritten at the owner's request on 2026-11-22. Check with the owner
 * before changing it again.
 *
 * No "we": the lines speak about the names, to the reader, and nobody speaks for a group.
 */
export const MEMORIAL_HELD_MESSAGE_LINES = [
  'These names are here so nobody gets to forget them.',
  "Some of them you know. Most of them, until now, you didn't.",
  "The fight for equality isn't over, and every name here says so.",
  "This list isn't finished, and it never will be.",
] as const;

export const MEMORIAL_LIST_LEDE =
  'Alphabetical, each with the year and the place the archive holds for them.';

export const MEMORIAL_LIST_NOTE =
  'This list is incomplete and always will be. If a name belongs here and is missing, send the evidence through Submit, or write to me@geralddagher.com.';

/**
 * Deterministic seed for the wall's handwriting layout. The value still reads `v6` and is
 * deliberately unchanged: it is a seed, not a label, and rewriting the string would reshuffle
 * every name's position, size and ink on a memorial wall. It moved here from the route's
 * Reading-room styles own the memorial entry label.
 */
export const MEMORIAL_WALL_SEED = 'memorial-edition-v6';
