/**
 * User-facing copy for the /memorial edition. Dignity-first; incomplete by design.
 */

export const MEMORIAL_PAGE_TITLE = 'Memorial';

export const MEMORIAL_PAGE_DESCRIPTION =
  'A living memorial wall of names held in remembrance. Incomplete by design. People. Places. Evidence. Context.';

export const MEMORIAL_KICKER = 'Remembrance';

export const MEMORIAL_LEDE =
  'Names written by hand across this page. They fade in and out so the wall keeps moving, while the full list below stays readable.';

export const MEMORIAL_INTRO_PARAGRAPHS = [
  'This memorial is not a complete roll call, and it does not pretend to be. It holds names so they are harder to lose in the scroll of news cycles and map pins.',
  'The handwritten wall behind these cards is atmosphere. The list on this page is the record you can read, search, and share with care.',
] as const;

export const MEMORIAL_LIST_NOTE =
  'This list is curated and incomplete. If a name belongs here and is missing, use Submit to send evidence for review.';

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

export const MEMORIAL_QUIET_LIST_LINK_LABEL = 'Read every name held here';
