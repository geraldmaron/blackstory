/**
 * Citation formatting for archive records.
 *
 * The accessed date is injected rather than read from the clock so a citation is reproducible in
 * tests and identical for every reader rendering the same record on the same day.
 *
 * Format is fixed by docs/ui/design-direction-v9-atlas.md §7 and must not be re-punctuated:
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
