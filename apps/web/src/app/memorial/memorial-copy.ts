/**
 * User-facing copy for the /memorial edition. Dignity-first; incomplete by design.
 */

/**
 * The room says what it holds rather than naming its own genre. "Memorial" is the label on the
 * door; this is the sentence a reader arrives on.
 */
export const MEMORIAL_PAGE_TITLE = 'Every name the archive has been given';

export const MEMORIAL_PAGE_DESCRIPTION =
  'A living memorial wall of names held in remembrance. Incomplete by design. People. Places. Evidence. Context.';

export const MEMORIAL_KICKER = 'Held in remembrance';

export const MEMORIAL_PAGE_LEDE =
  'Written by hand, one at a time. The wall holds them as handwriting; the list below holds the same names in an order you can search.';

/**
 * "Held in the Wall" message: assembles from the wall's own handwriting
 * mechanic, one line at a time, then holds fixed at center permanently.
 * Approved copy. Do not rewrite without checking with product first.
 */
export const MEMORIAL_HELD_MESSAGE_LINES = [
  'We say their names because silence is how forgetting starts.',
  "Some of these names you know. Most of them, until now, you didn't.",
  'Every one is a reminder: the fight for equality is not over.',
  'This list will never be finished. That is not a flaw. It is the truth.',
] as const;

export const MEMORIAL_LIST_NOTE =
  'This list is curated and incomplete. If a name belongs here and is missing, use Submit to send evidence for review.';

export const MEMORIAL_QUIET_LIST_LINK_LABEL = 'Read every name';

/** Spoken name for the cue above, which is deliberately terse on screen. */
export const MEMORIAL_QUIET_LIST_LINK_A11Y_LABEL = 'Read every name held here';
