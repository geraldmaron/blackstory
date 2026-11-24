/**
 * MLA, APA and Chicago citations for a page of the archive, as the web builds them.
 *
 * shortcut: this is a line-for-line port of the styled half of
 * `apps/web/src/lib/citation/format.ts`, because the app cannot import from the web app and the
 * formatter does not yet live in a shared package. `format.test.ts` runs both on the same inputs
 * and fails on any difference. Move the formatter into `packages/public-contracts` and delete
 * this file when the web can change its import in the same commit.
 */
export type StyledCitationPart = string | { readonly i: string };

export type StyledCitationInput = {
  /** The page's title: a record's name, a story's title. */
  readonly title: string;
  readonly url: string;
  /** Injected so citations are deterministic. */
  readonly accessed: Date;
  /** The page's publication or last-revision date. Omit when it is not on record. */
  readonly published?: Date | undefined;
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

/** The three styles in the order the web's Cite control shows them. */
export function formatStyledCitations(
  input: StyledCitationInput,
): { readonly style: string; readonly parts: StyledCitationPart[] }[] {
  return [
    { style: 'MLA', parts: formatMla(input) },
    { style: 'APA', parts: formatApa(input) },
    { style: 'Chicago', parts: formatChicago(input) },
  ];
}
