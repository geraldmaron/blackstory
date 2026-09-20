/**
 * The one count line every filtering room prints: "12 law entries", "3 of 12 law entries",
 * "4,218 records · page 2 of 43".
 *
 * Four routes each wrote this sentence by hand and each got a different part wrong: /law dropped
 * the thousands separator and pluralized on the matched count ("1 of 12 law entry"), /records
 * printed "1 records", /stories always printed "48 of 48". The noun agrees with the number it
 * follows, which in the narrowed form is the total.
 */

export type ResultSummaryInput = {
  /** Rows that survive the current narrowing. */
  readonly matched: number;
  /** Rows in the whole list. */
  readonly total: number;
  readonly singular: string;
  readonly plural: string;
  readonly page?: number | undefined;
  readonly pageCount?: number | undefined;
};

const count = (value: number) => value.toLocaleString('en-US');

export function formatResultSummary({
  matched,
  total,
  singular,
  plural,
  page,
  pageCount,
}: ResultSummaryInput): string {
  const noun = (value: number) => (value === 1 ? singular : plural);
  const base =
    matched === total
      ? `${count(total)} ${noun(total)}`
      : `${count(matched)} of ${count(total)} ${noun(total)}`;
  return page !== undefined && pageCount !== undefined && pageCount > 1
    ? `${base} · page ${count(page)} of ${count(pageCount)}`
    : base;
}
