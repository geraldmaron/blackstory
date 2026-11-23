/**
 * Citation formatting for archive records.
 *
 * The accessed date is injected rather than read from the clock so a citation is reproducible in
 * tests and identical for every reader rendering the same record on the same day.
 *
 * Format is fixed by docs/ui/archive/design-direction-v9-atlas.md §7 and must not be re-punctuated:
 *   "{name}." BlackStory Archive, {place}, {era}. Evidence grade {grade}, {n} sources. Accessed {YYYY-MM-DD}. {url}
 */

export type CitationInput = {
  readonly name: string;
  readonly place: string;
  readonly era: string;
  readonly grade: string;
  readonly sourceCount: number;
  readonly url: string;
  /** Injected so citations are deterministic. */
  readonly accessed: Date;
};

/** ISO calendar date in UTC, so a citation does not shift with the reader's timezone. */
export function formatAccessedDate(accessed: Date): string {
  if (Number.isNaN(accessed.getTime())) {
    throw new Error('Cannot format a citation with an invalid accessed date');
  }
  return accessed.toISOString().slice(0, 10);
}

export function formatCitation(input: CitationInput): string {
  const sources = input.sourceCount === 1 ? '1 source' : `${input.sourceCount} sources`;
  return (
    `"${input.name}." BlackStory Archive, ${input.place}, ${input.era}. ` +
    `Evidence grade ${input.grade}, ${sources}. ` +
    `Accessed ${formatAccessedDate(input.accessed)}. ${input.url}`
  );
}

/**
 * MLA, APA and Chicago citations for a page of the archive (docs/ui/DESIGN.md section 7.3). They
 * sit beside the house format above and do not replace it.
 *
 * A page has a corporate author (the archive), so the site name stands in the author position
 * where the style calls for one. A citation's date is the page's own publication or revision
 * date, never the subject's date; when the page has none, MLA and Chicago leave it out and APA
 * prints "n.d.". Each function returns runs of text so the title or site name can be italic.
 *
 * shortcut: these follow the styles' general web-page forms, checked against published examples
 * by hand, not by a style authority. Review against real records before the Cite control ships
 * on a public page (DESIGN.md section 7.6).
 */
export type StyledCitationPart = string | { readonly i: string };

export type StyledCitationInput = {
  /** The page's title: a record's name, a figure's headline, a story's title. */
  readonly title: string;
  readonly url: string;
  /** Injected so citations are deterministic. */
  readonly accessed: Date;
  /** The page's publication or last-revision date. Omit when it is not on record. */
  readonly published?: Date;
  readonly siteName?: string;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
/** MLA abbreviates every month longer than four letters. */
const MLA_MONTHS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

function assertValid(date: Date, what: string): void {
  if (Number.isNaN(date.getTime()))
    throw new Error(`Cannot format a citation with an invalid ${what} date`);
}

/** "23 Nov. 2026", in UTC so the date does not shift with the reader's timezone. */
function mlaDate(date: Date): string {
  return `${date.getUTCDate()} ${MLA_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "November 23, 2026". */
function longDate(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** A title that already ends a sentence does not get a second mark. */
function closed(title: string): string {
  return /[.?!]$/.test(title) ? title : `${title}.`;
}

export function formatMla(input: StyledCitationInput): StyledCitationPart[] {
  assertValid(input.accessed, 'accessed');
  const site = input.siteName ?? 'BlackStory';
  const published = input.published ? `${mlaDate(input.published)}, ` : '';
  return [
    `"${closed(input.title)}" `,
    { i: site },
    `, ${published}${input.url}. Accessed ${mlaDate(input.accessed)}.`,
  ];
}

export function formatApa(input: StyledCitationInput): StyledCitationPart[] {
  assertValid(input.accessed, 'accessed');
  const site = input.siteName ?? 'BlackStory';
  const date = input.published
    ? `${input.published.getUTCFullYear()}, ${MONTHS[input.published.getUTCMonth()]} ${input.published.getUTCDate()}`
    : 'n.d.';
  return [
    `${site}. (${date}). `,
    { i: closed(input.title) },
    ` Retrieved ${longDate(input.accessed)}, from ${input.url}`,
  ];
}

export function formatChicago(input: StyledCitationInput): StyledCitationPart[] {
  assertValid(input.accessed, 'accessed');
  const site = input.siteName ?? 'BlackStory';
  const published = input.published ? `Last modified ${longDate(input.published)}. ` : '';
  return [
    `${site}. "${closed(input.title)}" ${published}Accessed ${longDate(input.accessed)}. ${input.url}.`,
  ];
}

/** The three styles in the order the Cite control shows them. */
export function formatStyledCitations(
  input: StyledCitationInput,
): { readonly style: string; readonly parts: StyledCitationPart[] }[] {
  return [
    { style: 'MLA', parts: formatMla(input) },
    { style: 'APA', parts: formatApa(input) },
    { style: 'Chicago', parts: formatChicago(input) },
  ];
}
